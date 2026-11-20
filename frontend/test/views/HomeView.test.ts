import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import { toast } from "vue-sonner";
import HomeView from "@/views/HomeView.vue";
import { useGameStore, type Cell, type DifficultyRating } from "@/stores/gameStore";
import { useUserStore } from "@/stores/userStore";
import { useDialog } from "@/composables/useDialog";
import { useGameSession } from "@/composables/useGameSession";
import type { GameSnapshot } from "@/validation/localStorage";
import * as sudokuService from "@/services/sudokuService";
import { createBlankCells } from "@/utils/puzzleUtils";

// Only the network, router and toast boundaries are mocked. The stores, session
// and dialog run for real so these tests check what the player sees.
vi.mock("@/services/sudokuService", () => ({
  getNewPuzzle: vi.fn(),
  getSavedProgress: vi.fn(),
  saveProgress: vi.fn(),
}));

const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("vue-router", () => ({
  useRouter: () => router,
}));

// Icon is an anonymous component, so it can't be stubbed by name.
vi.mock("@iconify/vue", async () => {
  const { defineComponent, h } = await import("vue");
  return {
    Icon: defineComponent({
      props: { icon: String },
      setup: (props) => () => h("i", { "data-icon": props.icon }),
    }),
  };
});

vi.mock("vue-sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), promise: vi.fn() },
}));

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

// A game saved by an earlier visit. It's written by the app's own saveLocal on a
// throwaway store, so it always has the current format.
function savedGame(overrides: Partial<GameSnapshot> = {}) {
  setActivePinia(createPinia());
  const session = useGameSession();
  session.applySnapshot(localGame(overrides));
  session.saveLocal();
  setActivePinia(pinia);
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

let pinia: Pinia;
let wrapper: VueWrapper | undefined;

async function mountHome() {
  wrapper = mount(HomeView, { global: { plugins: [pinia] } });
  await flushPromises();
  return wrapper;
}

function buttonWithText(w: VueWrapper, text: string) {
  return w.findAll("button").find((b) => b.text().trim() === text);
}
function resumeButton(w: VueWrapper) {
  return w.findAll("button").find((b) => b.text().trim() === "Resume Game" || b.find("[data-icon]").exists());
}
function dialogButton(text: string) {
  return useDialog().dialogState.value!.buttons.find((b) => b.text === text)!;
}
// Clicks a button in the app-wide dialog the way AppDialog does: wait for
// onClick, then close if closeOnClick is set.
async function clickDialogButton(text: string) {
  const btn = dialogButton(text);
  await btn.onClick?.();
  if (btn.closeOnClick) useDialog().closeDialog();
  await flushPromises();
}
function sudokuRoute(difficulty: DifficultyRating | undefined) {
  return { name: "sudoku", params: { difficulty } };
}

describe("HomeView.vue", () => {
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    localStorage.clear();
    vi.clearAllMocks();
    useDialog().closeDialog();
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  describe("rendering", () => {
    it("shows the title, prompt and a button for each difficulty", async () => {
      const w = await mountHome();

      expect(w.text()).toContain("Infinite Sudoku");
      expect(w.text()).toContain("Pick a difficulty to get started");
      for (const label of ["Beginner", "Easy", "Medium", "Hard"]) {
        expect(buttonWithText(w, label)).toBeDefined();
      }
    });

    it("hides Resume Game when there is no game in progress", async () => {
      const w = await mountHome();

      expect(resumeButton(w)).toBeUndefined();
    });

    it("shows Resume Game when a saved local game is in progress", async () => {
      savedGame();

      const w = await mountHome();

      expect(buttonWithText(w, "Resume Game")).toBeDefined();
    });

    it("hides Resume Game when the saved local game is already solved", async () => {
      savedGame({ cells: cellsFrom(SOLVED) });

      const w = await mountHome();

      expect(resumeButton(w)).toBeUndefined();
    });

    it("shows Resume Game for a signed-in user with a puzzle saved on the server", async () => {
      signIn("server-1");

      const w = await mountHome();

      expect(buttonWithText(w, "Resume Game")).toBeDefined();
    });

    it("hides Resume Game for a signed-in user without a saved puzzle", async () => {
      signIn();

      const w = await mountHome();

      expect(resumeButton(w)).toBeUndefined();
    });

    it("ignores a server puzzle id when the user isn't signed in", async () => {
      useUserStore().currentPuzzleId = "server-1";

      const w = await mountHome();

      expect(resumeButton(w)).toBeUndefined();
    });

    it("shows a spinner instead of the Resume Game label while loading", async () => {
      savedGame();
      const w = await mountHome();

      useGameStore().loading = true;
      await flushPromises();

      const btn = resumeButton(w)!;
      expect(btn.text()).not.toContain("Resume Game");
      expect(btn.find("[data-icon]").attributes("data-icon")).toBe("line-md:loading-twotone-loop");
    });
  });

  describe("on mount", () => {
    it("loads the saved local game into the store", async () => {
      savedGame({ elapsedSeconds: 123 });

      await mountHome();
      const store = useGameStore();

      expect(store.puzzleId).toBe("local-1");
      expect(store.elapsedSeconds).toBe(123);
      expect(store.cells[40].value).toBe(3);
    });

    it("discards a corrupt saved game", async () => {
      localStorage.setItem(SESSION_KEY, "{not json");

      const w = await mountHome();

      expect(localStorage.getItem(SESSION_KEY)).toBeNull();
      expect(useGameStore().puzzleId).toBeUndefined();
      expect(resumeButton(w)).toBeUndefined();
    });
  });

  describe("starting a new puzzle with no game in progress", () => {
    it.each([
      ["Beginner", "beginner"],
      ["Easy", "easy"],
      ["Medium", "medium"],
      ["Hard", "hard"],
    ] as const)("%s goes straight to a %s puzzle", async (label, difficulty) => {
      const w = await mountHome();

      await buttonWithText(w, label)!.trigger("click");

      expect(useDialog().isOpen.value).toBe(false);
      expect(router.push).toHaveBeenCalledExactlyOnceWith(sudokuRoute(difficulty));
    });

    it("clears a finished saved game and resets the store", async () => {
      savedGame({ cells: cellsFrom(SOLVED) });
      const w = await mountHome();

      await buttonWithText(w, "Medium")!.trigger("click");

      expect(localStorage.getItem(SESSION_KEY)).toBeNull();
      expect(useGameStore().puzzleId).toBeUndefined();
      expect(router.push).toHaveBeenCalledExactlyOnceWith(sudokuRoute("medium"));
    });
  });

  describe("starting a new puzzle with a game in progress", () => {
    beforeEach(() => savedGame());

    it("asks before overwriting instead of navigating", async () => {
      const w = await mountHome();

      await buttonWithText(w, "Hard")!.trigger("click");

      expect(useDialog().isOpen.value).toBe(true);
      expect(useDialog().dialogState.value?.title).toBe("Overwrite current game?");
      expect(useDialog().dialogState.value?.buttons.map((b) => b.text)).toEqual([
        "Resume saved game",
        "New Game",
      ]);
      expect(router.push).not.toHaveBeenCalled();
      expect(localStorage.getItem(SESSION_KEY)).not.toBeNull();
    });

    it("New Game discards the saved game and starts the chosen difficulty", async () => {
      const w = await mountHome();
      await buttonWithText(w, "Hard")!.trigger("click");

      await clickDialogButton("New Game");

      expect(useDialog().isOpen.value).toBe(false);
      expect(localStorage.getItem(SESSION_KEY)).toBeNull();
      expect(useGameStore().puzzleId).toBeUndefined();
      expect(router.push).toHaveBeenCalledExactlyOnceWith(sudokuRoute("hard"));
    });

    it("Resume saved game keeps the saved game and returns to it", async () => {
      const w = await mountHome();
      await buttonWithText(w, "Hard")!.trigger("click");

      await clickDialogButton("Resume saved game");

      expect(useDialog().isOpen.value).toBe(false);
      expect(localStorage.getItem(SESSION_KEY)).not.toBeNull();
      expect(useGameStore().puzzleId).toBe("local-1");
      expect(router.push).toHaveBeenCalledExactlyOnceWith(sudokuRoute("easy"));
    });

    it("also asks when a signed-in user has a puzzle saved on the server", async () => {
      localStorage.clear();
      signIn("server-1");
      const w = await mountHome();

      await buttonWithText(w, "Easy")!.trigger("click");

      expect(useDialog().dialogState.value?.title).toBe("Overwrite current game?");
      expect(router.push).not.toHaveBeenCalled();
    });
  });

  describe("resuming", () => {
    it("returns to the local game at its own difficulty without calling the server", async () => {
      savedGame({ difficultyRating: "medium" });
      const w = await mountHome();

      await buttonWithText(w, "Resume Game")!.trigger("click");
      await flushPromises();

      expect(getSavedProgress).not.toHaveBeenCalled();
      expect(router.push).toHaveBeenCalledExactlyOnceWith(sudokuRoute("medium"));
    });

    it("loads the server puzzle for a signed-in user and goes to its difficulty", async () => {
      signIn("server-1");
      getSavedProgress.mockResolvedValue(serverPuzzle("hard"));
      const w = await mountHome();

      await buttonWithText(w, "Resume Game")!.trigger("click");
      await flushPromises();
      const store = useGameStore();

      expect(getSavedProgress).toHaveBeenCalledExactlyOnceWith("server-1");
      expect(store.puzzleId).toBe("server-1");
      expect(store.difficultyRating).toBe("hard");
      expect(store.elapsedSeconds).toBe(42);
      expect(store.loading).toBe(false);
      expect(router.push).toHaveBeenCalledExactlyOnceWith(sudokuRoute("hard"));
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("prefers the server puzzle over a local game", async () => {
      savedGame({ difficultyRating: "easy" });
      signIn("server-1");
      getSavedProgress.mockResolvedValue(serverPuzzle("hard"));
      const w = await mountHome();

      await buttonWithText(w, "Resume Game")!.trigger("click");
      await flushPromises();

      expect(getSavedProgress).toHaveBeenCalledExactlyOnceWith("server-1");
      expect(useGameStore().puzzleId).toBe("server-1");
      expect(router.push).toHaveBeenCalledExactlyOnceWith(sudokuRoute("hard"));
    });

    it("shows the server's error and stays on the page when loading fails", async () => {
      signIn("server-1");
      getSavedProgress.mockResolvedValue({ success: false, status: 404, error: "Puzzle not found" });
      const w = await mountHome();

      await buttonWithText(w, "Resume Game")!.trigger("click");
      await flushPromises();

      expect(toast.error).toHaveBeenCalledExactlyOnceWith("Puzzle not found");
      expect(router.push).not.toHaveBeenCalled();
      expect(useGameStore().loading).toBe(false);
    });

    it("shows a fallback error when the failure has no message", async () => {
      signIn("server-1");
      getSavedProgress.mockResolvedValue({ success: false, status: 500 });
      const w = await mountHome();

      await buttonWithText(w, "Resume Game")!.trigger("click");
      await flushPromises();

      expect(toast.error).toHaveBeenCalledExactlyOnceWith("An error occured resuming puzzle");
      expect(router.push).not.toHaveBeenCalled();
    });

    it("shows the spinner while the server puzzle is loading", async () => {
      signIn("server-1");
      let resolve!: (v: ReturnType<typeof serverPuzzle>) => void;
      getSavedProgress.mockReturnValue(new Promise((r) => (resolve = r)));
      const w = await mountHome();

      await buttonWithText(w, "Resume Game")!.trigger("click");

      expect(resumeButton(w)!.find("[data-icon]").exists()).toBe(true);

      resolve(serverPuzzle());
      await flushPromises();

      expect(resumeButton(w)!.text()).toBe("Resume Game");
    });
  });
});
