import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import { flushPromises } from "@vue/test-utils";
import { toast } from "vue-sonner";
import { usePuzzleNavigation } from "@/composables/usePuzzleNavigation";
import { useGameSession } from "@/composables/useGameSession";
import { useDialog } from "@/composables/useDialog";
import { useGameStore, type Cell, type DifficultyRating } from "@/stores/gameStore";
import { useUserStore } from "@/stores/userStore";
import type { GameSnapshot } from "@/validation/localStorage";
import * as sudokuService from "@/services/sudokuService";
import { createBlankCells } from "@/utils/puzzleUtils";

// Only the network, router and toast boundaries are mocked. The stores,
// session and dialog run for real so these tests check the resulting state.
vi.mock("@/services/sudokuService", () => ({
  getNewPuzzle: vi.fn(),
  getSavedProgress: vi.fn(),
  saveProgress: vi.fn(),
}));

const router = vi.hoisted(() => ({ push: vi.fn() }));
// The page the player is on; tests point it at a puzzle page when it matters.
const route = vi.hoisted(() => ({ name: "home", params: {} as Record<string, unknown> }));
vi.mock("vue-router", () => ({
  useRouter: () => router,
  useRoute: () => route,
}));

function onPuzzlePage(difficulty: DifficultyRating) {
  route.name = "sudoku";
  route.params = { difficulty };
}

vi.mock("vue-sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const getNewPuzzle = vi.mocked(sudokuService.getNewPuzzle);
const getSavedProgress = vi.mocked(sudokuService.getSavedProgress);

const SESSION_KEY = "sudoku.game";
const SOLVED =
  "534678912" +
  "672195348" +
  "198342567" +
  "859761423" +
  "426853791" +
  "713924856" +
  "961537284" +
  "287419635" +
  "345286179";

function cellsFrom(digits: string): Cell[] {
  return digits.split("").map((d, idx) => ({ idx, value: Number(d), candidates: [] }));
}

function puzzleCells(): Cell[] {
  const cells = createBlankCells();
  cells[0].value = 5;
  cells[80].value = 9;
  return cells;
}

function localGame(overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  const cells = puzzleCells();
  cells[40].value = 3;
  return {
    puzzleId: "local-1",
    cells,
    originalCells: puzzleCells(),
    difficultyRating: "easy",
    difficultyScore: 100,
    usingPencil: false,
    selectedIdx: undefined,
    history: [{ isParent: true, cell: { idx: 40, value: 0, candidates: [] } }],
    redoActions: [],
    autoCandidateMode: false,
    elapsedSeconds: 300,
    state: "paused",
    ...overrides,
  };
}

// A game in progress, both in the store and saved locally, the way it is after
// a page has loaded it.
function gameInProgress(overrides: Partial<GameSnapshot> = {}) {
  const session = useGameSession();
  session.applySnapshot(localGame(overrides));
  session.saveLocal();
}

function signIn(currentPuzzleId?: string) {
  useUserStore().set({ id: "user-1", email: "a@b.c", role: "user", currentPuzzleId });
}

function serverPuzzle(difficulty: DifficultyRating = "hard", puzzleId = "server-1") {
  return {
    success: true as const,
    status: 200,
    body: {
      puzzleId,
      difficultyRating: difficulty,
      difficultyScore: 250,
      originalCells: puzzleCells(),
      cells: puzzleCells(),
      actions: [],
      elapsedSeconds: 42,
    },
  };
}

function newPuzzle(difficulty: DifficultyRating, puzzleId = "new-1") {
  return {
    success: true as const,
    status: 200,
    body: { puzzleId, cells: puzzleCells(), difficultyRating: difficulty, difficultyScore: 100 },
  };
}

function sudokuRoute(difficulty: DifficultyRating) {
  return { name: "sudoku", params: { difficulty } };
}

function dialog() {
  return useDialog().dialogState.value;
}
// Clicks a button in the app-wide dialog the way AppDialog does: wait for
// onClick, then close if closeOnClick is set.
async function clickDialogButton(text: string) {
  const btn = dialog()!.buttons.find((b) => b.text === text)!;
  await btn.onClick?.();
  if (btn.closeOnClick) useDialog().closeDialog();
}

let pinia: Pinia;

describe("usePuzzleNavigation", () => {
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    localStorage.clear();
    vi.clearAllMocks();
    route.name = "home";
    route.params = {};
    useDialog().closeDialog();
  });

  describe("resumePuzzle", () => {
    it("does nothing when there is no game to resume", async () => {
      await usePuzzleNavigation().resumePuzzle();

      expect(getSavedProgress).not.toHaveBeenCalled();
      expect(router.push).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("returns to the local game at its own difficulty without calling the server", async () => {
      gameInProgress({ difficultyRating: "medium" });

      await usePuzzleNavigation().resumePuzzle();

      expect(getSavedProgress).not.toHaveBeenCalled();
      expect(useGameStore().puzzleId).toBe("local-1");
      expect(router.push).toHaveBeenCalledExactlyOnceWith(sudokuRoute("medium"));
    });

    it("loads a signed-in user's server puzzle and goes to its difficulty", async () => {
      signIn("server-1");
      getSavedProgress.mockResolvedValue(serverPuzzle("hard"));

      await usePuzzleNavigation().resumePuzzle();
      const store = useGameStore();

      expect(getSavedProgress).toHaveBeenCalledExactlyOnceWith("server-1");
      expect(store.puzzleId).toBe("server-1");
      expect(store.difficultyRating).toBe("hard");
      expect(store.elapsedSeconds).toBe(42);
      expect(store.loading).toBe(false);
      expect(router.push).toHaveBeenCalledExactlyOnceWith(sudokuRoute("hard"));
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("prefers the server puzzle over a local game, and navigates only once", async () => {
      gameInProgress({ difficultyRating: "easy" });
      signIn("server-1");
      getSavedProgress.mockResolvedValue(serverPuzzle("hard"));

      await usePuzzleNavigation().resumePuzzle();

      expect(useGameStore().puzzleId).toBe("server-1");
      expect(router.push).toHaveBeenCalledExactlyOnceWith(sudokuRoute("hard"));
    });

    it("saves the resumed server puzzle locally", async () => {
      signIn("server-1");
      getSavedProgress.mockResolvedValue(serverPuzzle("hard"));

      await usePuzzleNavigation().resumePuzzle();

      expect(JSON.parse(localStorage.getItem(SESSION_KEY)!).puzzleId).toBe("server-1");
    });

    it("shows the server's error, keeps the local game and stays put when loading fails", async () => {
      gameInProgress();
      signIn("server-1");
      getSavedProgress.mockResolvedValue({ success: false, status: 404, error: "Puzzle not found" });

      await usePuzzleNavigation().resumePuzzle();

      expect(toast.error).toHaveBeenCalledExactlyOnceWith("Puzzle not found");
      expect(useGameStore().puzzleId).toBe("local-1");
      expect(useGameStore().loading).toBe(false);
      expect(router.push).not.toHaveBeenCalled();
    });

    it("shows a fallback error when the failure has no message", async () => {
      signIn("server-1");
      getSavedProgress.mockResolvedValue({ success: false, status: 500 });

      await usePuzzleNavigation().resumePuzzle();

      expect(toast.error).toHaveBeenCalledExactlyOnceWith("An error occured resuming puzzle");
      expect(router.push).not.toHaveBeenCalled();
    });

    it("reports, rather than throws, when the request itself fails", async () => {
      signIn("server-1");
      getSavedProgress.mockRejectedValue(new Error("network down"));

      await expect(usePuzzleNavigation().resumePuzzle()).resolves.toBeUndefined();

      expect(toast.error).toHaveBeenCalledOnce();
      expect(vi.mocked(toast.error).mock.calls[0]![0]).toContain("network down");
      expect(useGameStore().loading).toBe(false);
      expect(router.push).not.toHaveBeenCalled();
    });

    it("does not navigate when the resumed puzzle has no difficulty", async () => {
      // vue-router throws "Missing required param" for a sudoku route with no
      // difficulty, unless the user is already on a sudoku page.
      signIn("server-1");
      const noRating = serverPuzzle();
      noRating.body.difficultyRating = undefined as unknown as DifficultyRating;
      getSavedProgress.mockResolvedValue(noRating);

      await expect(usePuzzleNavigation().resumePuzzle()).resolves.toBeUndefined();

      expect(getSavedProgress).toHaveBeenCalledOnce();
      expect(router.push).not.toHaveBeenCalled();
    });
  });

  describe("startFresh", () => {
    it("discards the saved game, resets the store and goes to the chosen difficulty", () => {
      gameInProgress();

      usePuzzleNavigation().startFresh("beginner");

      expect(localStorage.getItem(SESSION_KEY)).toBeNull();
      expect(useGameStore().puzzleId).toBeUndefined();
      expect(useGameStore().elapsedSeconds).toBe(0);
      expect(router.push).toHaveBeenCalledExactlyOnceWith(sudokuRoute("beginner"));
    });

    it("navigates instead of loading when on a puzzle page for another difficulty", async () => {
      onPuzzlePage("easy");
      gameInProgress();

      await usePuzzleNavigation().startFresh("hard");

      // The hard page mounts and loads its own puzzle.
      expect(getNewPuzzle).not.toHaveBeenCalled();
      expect(router.push).toHaveBeenCalledExactlyOnceWith(sudokuRoute("hard"));
    });

    describe("on the page for the chosen difficulty", () => {
      // Pushing the current URL doesn't remount the page, so nothing would load
      // the new puzzle; startFresh has to load it in place.
      beforeEach(() => {
        onPuzzlePage("easy");
        gameInProgress({ difficultyRating: "easy" });
      });

      it("loads a new puzzle in place instead of navigating", async () => {
        getNewPuzzle.mockResolvedValue(newPuzzle("easy"));

        await usePuzzleNavigation().startFresh("easy");
        const store = useGameStore();

        expect(getNewPuzzle).toHaveBeenCalledExactlyOnceWith("easy");
        expect(router.push).not.toHaveBeenCalled();
        expect(store.puzzleId).toBe("new-1");
        expect(store.difficultyRating).toBe("easy");
        expect(store.elapsedSeconds).toBe(0);
        expect(store.history).toEqual([]);
        expect(store.isTimerRunning).toBe(true);
        expect(JSON.parse(localStorage.getItem(SESSION_KEY)!).puzzleId).toBe("new-1");
        expect(useDialog().isOpen.value).toBe(false);
      });

      it("shows the loading state until the new puzzle arrives", async () => {
        let resolve!: (v: ReturnType<typeof newPuzzle>) => void;
        getNewPuzzle.mockReturnValue(new Promise((r) => (resolve = r)));

        const fresh = usePuzzleNavigation().startFresh("easy");

        expect(useGameStore().loading).toBe(true);

        resolve(newPuzzle("easy"));
        await fresh;

        expect(useGameStore().loading).toBe(false);
      });

      it("keeps the current game and shows the error dialog when loading fails", async () => {
        getNewPuzzle.mockResolvedValue({ success: false, status: 503, error: "Server down" });

        await usePuzzleNavigation().startFresh("easy");

        expect(dialog()?.title).toBe("Error Fetching Puzzle");
        expect(dialog()?.message).toBe("Server down");
        // The kept game is this page's difficulty, so there's no "Back to" option.
        expect(dialog()?.buttons.map((b) => b.text)).toEqual(["Retry", "Cancel"]);
        expect(useGameStore().puzzleId).toBe("local-1");
        expect(useGameStore().elapsedSeconds).toBe(300);
        expect(JSON.parse(localStorage.getItem(SESSION_KEY)!).puzzleId).toBe("local-1");
        expect(useGameStore().loading).toBe(false);
        expect(router.push).not.toHaveBeenCalled();
      });

      it("Cancel in the error dialog goes home with the current game still saved", async () => {
        getNewPuzzle.mockResolvedValue({ success: false, status: 503 });
        await usePuzzleNavigation().startFresh("easy");

        await clickDialogButton("Cancel");

        expect(router.push).toHaveBeenCalledExactlyOnceWith({ name: "home" });
        expect(JSON.parse(localStorage.getItem(SESSION_KEY)!).puzzleId).toBe("local-1");
      });

      it("makes the new puzzle a signed-in user's current puzzle", async () => {
        signIn("server-1");
        getNewPuzzle.mockResolvedValue(newPuzzle("easy"));

        await usePuzzleNavigation().startFresh("easy");

        expect(useUserStore().currentPuzzleId).toBe("new-1");
      });

      it("keeps a signed-in user's current puzzle when loading fails", async () => {
        signIn("server-1");
        getNewPuzzle.mockResolvedValue({ success: false, status: 503 });

        await usePuzzleNavigation().startFresh("easy");

        expect(useUserStore().currentPuzzleId).toBe("server-1");
      });

      it("Retry in the error dialog loads the puzzle in place", async () => {
        getNewPuzzle.mockResolvedValueOnce({ success: false, status: 503 });
        getNewPuzzle.mockResolvedValueOnce(newPuzzle("easy"));
        await usePuzzleNavigation().startFresh("easy");

        await clickDialogButton("Retry");

        expect(getNewPuzzle).toHaveBeenCalledTimes(2);
        expect(useDialog().isOpen.value).toBe(false);
        expect(useGameStore().puzzleId).toBe("new-1");
        expect(router.push).not.toHaveBeenCalled();
      });
    });
  });

  describe("loadNewPuzzle", () => {
    it("loads the puzzle and starts the clock", async () => {
      getNewPuzzle.mockResolvedValue(newPuzzle("medium"));

      await usePuzzleNavigation().loadNewPuzzle("medium");

      expect(useGameStore().puzzleId).toBe("new-1");
      expect(useGameStore().isTimerRunning).toBe(true);
      expect(useDialog().isOpen.value).toBe(false);
      expect(router.push).not.toHaveBeenCalled();
    });

    it("shows the status code when the failure has no message", async () => {
      getNewPuzzle.mockResolvedValue({ success: false, status: 500 });

      await usePuzzleNavigation().loadNewPuzzle("medium");

      expect(dialog()?.message).toBe("Error code: 500");
    });

    it("offers a way back to a kept game of another difficulty", async () => {
      gameInProgress({ difficultyRating: "easy" });
      getNewPuzzle.mockResolvedValue({ success: false, status: 503, error: "Server down" });

      await usePuzzleNavigation().loadNewPuzzle("hard");
      expect(dialog()?.buttons.map((b) => b.text)).toEqual(["Retry", "Back to easy game", "Cancel"]);

      await clickDialogButton("Back to easy game");

      expect(useDialog().isOpen.value).toBe(false);
      expect(useGameStore().puzzleId).toBe("local-1");
      expect(router.push).toHaveBeenCalledExactlyOnceWith(sudokuRoute("easy"));
    });

    it("offers no way back when the kept game is the same difficulty", async () => {
      gameInProgress({ difficultyRating: "hard" });
      getNewPuzzle.mockResolvedValue({ success: false, status: 503 });

      await usePuzzleNavigation().loadNewPuzzle("hard");

      expect(dialog()?.buttons.map((b) => b.text)).toEqual(["Retry", "Cancel"]);
    });

    it("Cancel closes the error and goes home", async () => {
      getNewPuzzle.mockResolvedValue({ success: false, status: 503 });
      await usePuzzleNavigation().loadNewPuzzle("hard");

      await clickDialogButton("Cancel");

      expect(useDialog().isOpen.value).toBe(false);
      expect(router.push).toHaveBeenCalledExactlyOnceWith({ name: "home" });
    });

    it("keeps the error up when Retry fails again", async () => {
      getNewPuzzle.mockResolvedValue({ success: false, status: 503, error: "Still down" });
      await usePuzzleNavigation().loadNewPuzzle("hard");

      await clickDialogButton("Retry");

      expect(getNewPuzzle).toHaveBeenCalledTimes(2);
      expect(dialog()?.title).toBe("Error Fetching Puzzle");
      expect(useDialog().isOpen.value).toBe(true);
    });
  });

  describe("chooseNewPuzzle", () => {
    describe("with no game in progress", () => {
      it.each(["beginner", "easy", "medium", "hard"] as const)(
        "goes straight to a %s puzzle without asking",
        (difficulty) => {
          usePuzzleNavigation().chooseNewPuzzle(difficulty);

          expect(useDialog().isOpen.value).toBe(false);
          expect(router.push).toHaveBeenCalledExactlyOnceWith(sudokuRoute(difficulty));
        },
      );

      it("clears a finished game instead of asking about it", () => {
        gameInProgress({ cells: cellsFrom(SOLVED) });

        usePuzzleNavigation().chooseNewPuzzle("medium");

        expect(useDialog().isOpen.value).toBe(false);
        expect(localStorage.getItem(SESSION_KEY)).toBeNull();
        expect(useGameStore().puzzleId).toBeUndefined();
        expect(router.push).toHaveBeenCalledExactlyOnceWith(sudokuRoute("medium"));
      });

      it("ignores a server puzzle id when the user isn't signed in", () => {
        useUserStore().currentPuzzleId = "server-1";

        usePuzzleNavigation().chooseNewPuzzle("easy");

        expect(useDialog().isOpen.value).toBe(false);
        expect(router.push).toHaveBeenCalledExactlyOnceWith(sudokuRoute("easy"));
      });
    });

    describe("with a game in progress", () => {
      it("asks before overwriting a local game, without navigating", () => {
        gameInProgress();

        usePuzzleNavigation().chooseNewPuzzle("hard");

        expect(useDialog().isOpen.value).toBe(true);
        expect(dialog()?.title).toBe("Overwrite current game?");
        expect(dialog()?.buttons.map((b) => b.text)).toEqual(["Resume saved game", "New Game"]);
        expect(dialog()?.buttons.every((b) => b.closeOnClick)).toBe(true);
        expect(router.push).not.toHaveBeenCalled();
        expect(localStorage.getItem(SESSION_KEY)).not.toBeNull();
      });

      it("asks when a signed-in user has a puzzle saved on the server", () => {
        signIn("server-1");

        usePuzzleNavigation().chooseNewPuzzle("easy");

        expect(dialog()?.title).toBe("Overwrite current game?");
        expect(router.push).not.toHaveBeenCalled();
      });

      it("New Game discards the game and starts the chosen difficulty", async () => {
        gameInProgress();
        usePuzzleNavigation().chooseNewPuzzle("hard");

        await clickDialogButton("New Game");

        expect(useDialog().isOpen.value).toBe(false);
        expect(localStorage.getItem(SESSION_KEY)).toBeNull();
        expect(useGameStore().puzzleId).toBeUndefined();
        expect(router.push).toHaveBeenCalledExactlyOnceWith(sudokuRoute("hard"));
      });

      it("Resume saved game keeps the local game and returns to its difficulty", async () => {
        gameInProgress({ difficultyRating: "easy" });
        usePuzzleNavigation().chooseNewPuzzle("hard");

        await clickDialogButton("Resume saved game");

        expect(localStorage.getItem(SESSION_KEY)).not.toBeNull();
        expect(useGameStore().puzzleId).toBe("local-1");
        expect(router.push).toHaveBeenCalledExactlyOnceWith(sudokuRoute("easy"));
      });

      it("Resume saved game loads a signed-in user's server puzzle", async () => {
        signIn("server-1");
        getSavedProgress.mockResolvedValue(serverPuzzle("medium"));
        usePuzzleNavigation().chooseNewPuzzle("hard");

        await clickDialogButton("Resume saved game");
        await vi.waitFor(() => expect(router.push).toHaveBeenCalled());

        expect(getSavedProgress).toHaveBeenCalledExactlyOnceWith("server-1");
        expect(router.push).toHaveBeenCalledExactlyOnceWith(sudokuRoute("medium"));
      });
    });

    describe("on the page for the chosen difficulty", () => {
      beforeEach(() => onPuzzlePage("easy"));

      it("loads a new puzzle in place after a solved game, without asking", async () => {
        gameInProgress({ difficultyRating: "easy", cells: cellsFrom(SOLVED) });
        getNewPuzzle.mockResolvedValue(newPuzzle("easy"));

        await usePuzzleNavigation().chooseNewPuzzle("easy");

        expect(useDialog().isOpen.value).toBe(false);
        expect(getNewPuzzle).toHaveBeenCalledExactlyOnceWith("easy");
        expect(useGameStore().puzzleId).toBe("new-1");
        expect(router.push).not.toHaveBeenCalled();
      });

      it("New Game loads a new puzzle in place", async () => {
        gameInProgress({ difficultyRating: "easy" });
        getNewPuzzle.mockResolvedValue(newPuzzle("easy"));
        await usePuzzleNavigation().chooseNewPuzzle("easy");

        await clickDialogButton("New Game");
        await flushPromises();

        expect(getNewPuzzle).toHaveBeenCalledExactlyOnceWith("easy");
        expect(useGameStore().puzzleId).toBe("new-1");
        expect(useGameStore().isTimerRunning).toBe(true);
        expect(router.push).not.toHaveBeenCalled();
      });

      it("keeps the error dialog open after the overwrite dialog closes when New Game fails", async () => {
        // The overwrite dialog closes on click; the error dialog it leads to
        // must not be closed along with it.
        gameInProgress({ difficultyRating: "easy" });
        getNewPuzzle.mockResolvedValue({ success: false, status: 503, error: "Server down" });
        await usePuzzleNavigation().chooseNewPuzzle("easy");

        await clickDialogButton("New Game");
        await flushPromises();

        expect(useDialog().isOpen.value).toBe(true);
        expect(dialog()?.title).toBe("Error Fetching Puzzle");
        expect(router.push).not.toHaveBeenCalled();
      });
    });
  });
});
