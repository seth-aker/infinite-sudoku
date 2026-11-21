import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useGameStore, type Cell } from "@/stores/gameStore";
import { useUserStore } from "@/stores/userStore";
import { useGameSession } from "@/composables/useGameSession";
import type { GameSnapshot } from "@/validation/localStorage";
import * as sudokuService from "@/services/sudokuService";
import { createBlankCells } from "@/utils/puzzleUtils";

vi.mock("@/services/sudokuService", () => ({
  getNewPuzzle: vi.fn(),
  getSavedProgress: vi.fn(),
  saveProgress: vi.fn(),
}));

// The real clock runs (on fake timers) so tests check whether the game is
// actually ticking, not which clock functions were called.
const getNewPuzzle = vi.mocked(sudokuService.getNewPuzzle);
const getSavedProgress = vi.mocked(sudokuService.getSavedProgress);
const saveProgress = vi.mocked(sudokuService.saveProgress);

const SESSION_KEY = "sudoku.game";

function puzzleCells(): Cell[] {
  const cells = createBlankCells();
  cells[0].value = 7;
  cells[80].value = 3;
  return cells;
}

function storedSnapshot(): GameSnapshot | null {
  const raw = localStorage.getItem(SESSION_KEY);
  return raw ? JSON.parse(raw) : null;
}

function sampleSnapshot(): GameSnapshot {
  const cells = puzzleCells();
  cells[40] = { idx: 40, value: 5, candidates: [] };
  cells[41] = { idx: 41, value: 0, candidates: [1, 2] };
  return {
    puzzleId: "puzzle-1",
    cells,
    originalCells: puzzleCells(),
    difficultyRating: "medium",
    difficultyScore: 250,
    usingPencil: true,
    selectedIdx: 41,
    history: [{ isParent: true, cell: { idx: 40, value: 0, candidates: [] } }],
    redoActions: [{ isParent: true, cell: { idx: 42, value: 9, candidates: [] } }],
    autoCandidateMode: true,
    elapsedSeconds: 125,
    state: "playing",
  };
}

describe("useGameSession", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
    localStorage.clear();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe("local snapshots", () => {
    it("saveLocal stores the current game and loadLocal restores it", () => {
      const session = useGameSession();
      session.applySnapshot(sampleSnapshot());
      session.saveLocal();

      setActivePinia(createPinia()); // simulate a page reload
      const reloaded = useGameSession();
      reloaded.loadLocal();

      expect(reloaded.takeSnapshot()).toEqual(sampleSnapshot());
    });

    it("loadLocal leaves the store untouched when nothing is saved", () => {
      const session = useGameSession();
      const before = session.takeSnapshot();

      session.loadLocal();

      expect(session.takeSnapshot()).toEqual(before);
    });

    it("loadLocal ignores a corrupted save", () => {
      localStorage.setItem(SESSION_KEY, "{not json");
      const session = useGameSession();
      const before = session.takeSnapshot();

      expect(() => session.loadLocal()).not.toThrow();
      expect(session.takeSnapshot()).toEqual(before);
    });

    it("clearLocal removes the save", () => {
      const session = useGameSession();
      session.saveLocal();

      session.clearLocal();

      expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    });

    it("does nothing when localStorage is unavailable", () => {
      vi.stubGlobal("localStorage", undefined);
      const session = useGameSession();

      expect(() => {
        session.saveLocal();
        session.loadLocal();
        session.clearLocal();
      }).not.toThrow();
    });

    it("saveLocal does not throw when storage is full", () => {
      const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("quota exceeded", "QuotaExceededError");
      });
      try {
        const session = useGameSession();
        session.applySnapshot(sampleSnapshot());

        expect(() => session.saveLocal()).not.toThrow();
      } finally {
        setItem.mockRestore();
      }
    });
  });

  describe("checking saved games on load", () => {
    // The stored JSON, loosely typed so tests can corrupt any part of it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type SavedJson = Record<string, any>;

    // A save written by the app itself, so each test starts from the current
    // format (version included) and changes one thing.
    function appSave(snapshot: GameSnapshot = sampleSnapshot()): SavedJson {
      const session = useGameSession();
      session.applySnapshot(snapshot);
      session.saveLocal();
      return JSON.parse(localStorage.getItem(SESSION_KEY)!);
    }

    // Stores `saved` and loads it into a fresh store, as a page reload would.
    function reloadWith(saved: unknown) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(saved));
      setActivePinia(createPinia());
      const session = useGameSession();
      const fresh = session.takeSnapshot();
      session.loadLocal();
      return { session, fresh };
    }

    // Confirms the untouched save loads, so a later rejection is down to the one
    // change the test made, not to the app writing invalid saves.
    function expectLoads(saved: SavedJson) {
      expect(reloadWith(saved).session.takeSnapshot().puzzleId).toBe(saved.puzzleId);
    }

    // A rejected save leaves the fresh game alone and is removed, so it isn't
    // re-checked and rejected on every page load.
    function expectRejected(saved: unknown) {
      const { session, fresh } = reloadWith(saved);

      expect(session.takeSnapshot()).toEqual(fresh);
      expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    }

    describe("accepts", () => {
      it("a save written by the current version", () => {
        const { session } = reloadWith(appSave());

        expect(session.takeSnapshot()).toEqual(sampleSnapshot());
        expect(localStorage.getItem(SESSION_KEY)).not.toBeNull();
      });

      it("a save whose optional fields are unset", () => {
        // JSON drops undefined, so these fields are absent from the stored save.
        const snapshot = { ...sampleSnapshot(), difficultyRating: undefined, selectedIdx: undefined };

        const { session } = reloadWith(appSave(snapshot));

        expect(session.takeSnapshot()).toEqual(snapshot);
      });

      it("a board using the edge values: empty (0) and 9, candidates 1 and 9", () => {
        const snapshot = sampleSnapshot();
        snapshot.cells[1] = { idx: 1, value: 9, candidates: [] };
        snapshot.cells[2] = { idx: 2, value: 0, candidates: [1, 9] };
        snapshot.selectedIdx = 80;

        const { session } = reloadWith(appSave(snapshot));

        expect(session.takeSnapshot()).toEqual(snapshot);
      });
    });

    describe("discards", () => {
      it("a save from before versioning", () => {
        expectRejected(sampleSnapshot()); // today's format: no version field
      });

      it("a save from a different version", () => {
        const saved = appSave();
        expectLoads(saved);

        expectRejected({ ...saved, version: saved.version + 1 });
      });

      it.each([
        ["null", null],
        ["an array", []],
        ["a string", "game"],
        ["a number", 42],
        ["an empty object", {}],
      ])("a save that is %s", (_, saved) => {
        expectRejected(saved);
      });

      it.each<[string, (saved: SavedJson) => void]>([
        ["is missing the board", (s) => delete s.cells],
        ["has a board of 80 cells", (s) => s.cells.pop()],
        ["has an original puzzle of 82 cells", (s) => s.originalCells.push({ idx: 81, value: 0, candidates: [] })],
        ["has cells out of order", (s) => ([s.cells[1], s.cells[2]] = [s.cells[2], s.cells[1]])],
        ["has a value above 9", (s) => (s.cells[40].value = 10)],
        ["has a value of -1 (an unparseable digit)", (s) => (s.cells[40].value = -1)],
        ["has a fractional value", (s) => (s.cells[40].value = 2.5)],
        ["has a value stored as a string", (s) => (s.cells[40].value = "5")],
        ["has a candidate of 0", (s) => (s.cells[41].candidates = [0])],
        ["has a candidate of 10", (s) => (s.cells[41].candidates = [10])],
        ["has an undo entry with a bad cell", (s) => (s.history[0].cell.candidates = [10])],
        ["has a redo entry missing isParent", (s) => delete s.redoActions[0].isParent],
        ["has an unknown game state", (s) => (s.state = "won")],
        ["has an unknown difficulty", (s) => (s.difficultyRating = "extreme")],
        ["has a negative time", (s) => (s.elapsedSeconds = -1)],
        ["has a selected index off the board", (s) => (s.selectedIdx = 81)],
      ])("a save that %s", (_, corrupt) => {
        const saved = appSave();
        expectLoads(saved);
        corrupt(saved);

        expectRejected(saved);
      });
    });
  });

  describe("saveToServer", () => {
    function signIn() {
      useUserStore().set({ id: "user-1", email: "a@b.c", role: "user" });
    }

    it("sends the current progress", async () => {
      signIn();
      const session = useGameSession();
      session.applySnapshot(sampleSnapshot());
      saveProgress.mockResolvedValue({ success: true, status: 200 });

      const result = await session.saveToServer(true);

      expect(result).toEqual({ success: true, status: 200 });
      expect(saveProgress).toHaveBeenCalledExactlyOnceWith({
        puzzleId: "puzzle-1",
        cells: sampleSnapshot().cells,
        history: sampleSnapshot().history,
        elapsedSeconds: 125,
        isSolved: false,
        keepAlive: true,
      });
    });

    it("does not save when signed out", async () => {
      const session = useGameSession();
      session.applySnapshot(sampleSnapshot());

      const result = await session.saveToServer();

      expect(result.success).toBe(false);
      expect(saveProgress).not.toHaveBeenCalled();
    });

    it("does not save when there is no puzzle", async () => {
      signIn();
      const session = useGameSession();

      const result = await session.saveToServer();

      expect(result.success).toBe(false);
      expect(saveProgress).not.toHaveBeenCalled();
    });
  });

  describe("startNewPuzzle", () => {
    function newPuzzle(): sudokuService.NewPuzzleResult {
      return {
        puzzleId: "new-1",
        cells: puzzleCells(),
        difficultyRating: "hard",
        difficultyScore: 400,
      };
    }

    it("loads the puzzle into a fresh game, starts the clock and saves locally", async () => {
      const session = useGameSession();
      session.applySnapshot(sampleSnapshot()); // a game already in progress
      getNewPuzzle.mockResolvedValue({ success: true, status: 200, body: newPuzzle() });

      const result = await session.startNewPuzzle("hard");
      const store = useGameStore();

      expect(getNewPuzzle).toHaveBeenCalledExactlyOnceWith("hard");
      expect(result.success).toBe(true);
      expect(store.puzzleId).toBe("new-1");
      expect(store.cells).toEqual(puzzleCells());
      expect(store.originalCells).toEqual(puzzleCells());
      expect(store.difficultyRating).toBe("hard");
      expect(store.difficultyScore).toBe(400);
      expect(store.history).toEqual([]);
      expect(store.redoActions).toEqual([]);
      expect(store.selectedIdx).toBeUndefined();
      expect(store.loading).toBe(false);
      expect(storedSnapshot()?.puzzleId).toBe("new-1");
    });

    it("starts the clock from zero, replacing the previous game's time", async () => {
      const session = useGameSession();
      session.applySnapshot(sampleSnapshot()); // 125 seconds in
      getNewPuzzle.mockResolvedValue({ success: true, status: 200, body: newPuzzle() });

      await session.startNewPuzzle("hard");
      const store = useGameStore();
      vi.advanceTimersByTime(2000);

      expect(store.state).toBe("playing");
      expect(store.isTimerRunning).toBe(true);
      expect(store.elapsedSeconds).toBe(2);
    });

    it("keeps the board and the original puzzle separate", async () => {
      const session = useGameSession();
      getNewPuzzle.mockResolvedValue({ success: true, status: 200, body: newPuzzle() });
      await session.startNewPuzzle("hard");
      const store = useGameStore();

      store.cells[40].value = 5;

      expect(store.originalCells[40].value).toBe(0);
    });

    it("sets the loading flag only while the request is in flight", async () => {
      let respond!: (r: Awaited<ReturnType<typeof getNewPuzzle>>) => void;
      getNewPuzzle.mockReturnValue(new Promise((r) => (respond = r)));
      const session = useGameSession();

      const pending = session.startNewPuzzle("hard");
      expect(useGameStore().loading).toBe(true);

      respond({ success: true, status: 200, body: newPuzzle() });
      await pending;
      expect(useGameStore().loading).toBe(false);
    });

    describe("for a signed-in user", () => {
      // The server makes a newly fetched puzzle the user's current puzzle.
      beforeEach(() => {
        useUserStore().set({ id: "user-1", email: "a@b.c", role: "user", currentPuzzleId: "saved-1" });
      });

      it("makes the new puzzle their current puzzle", async () => {
        getNewPuzzle.mockResolvedValue({ success: true, status: 200, body: newPuzzle() });

        await useGameSession().startNewPuzzle("hard");

        expect(useUserStore().currentPuzzleId).toBe("new-1");
        expect(useGameSession().hasInProgressPuzzle.value).toBe(true);
      });

      it.each([
        ["the request fails", () => getNewPuzzle.mockResolvedValue({ success: false, status: 503 })],
        ["the response has no body", () => getNewPuzzle.mockResolvedValue({ success: true, status: 200 })],
        ["the service throws", () => getNewPuzzle.mockRejectedValue(new Error("boom"))],
      ])("keeps their current puzzle when %s", async (_, arrange) => {
        arrange();

        await useGameSession().startNewPuzzle("hard");

        expect(useUserStore().currentPuzzleId).toBe("saved-1");
      });
    });

    it("doesn't give a signed-out player a current puzzle", async () => {
      getNewPuzzle.mockResolvedValue({ success: true, status: 200, body: newPuzzle() });

      await useGameSession().startNewPuzzle("hard");

      expect(useUserStore().currentPuzzleId).toBeUndefined();
    });

    describe("when the puzzle cannot be loaded", () => {
      it.each([
        ["the request fails", { success: false as const, status: 503, error: "down" }],
        ["the response has no body", { success: true as const, status: 200 }],
      ])("keeps the current game when %s", async (_, response) => {
        const session = useGameSession();
        session.applySnapshot(sampleSnapshot());
        getNewPuzzle.mockResolvedValue(response);

        const result = await session.startNewPuzzle("hard");
        vi.advanceTimersByTime(2000);

        // The snapshot includes elapsedSeconds, so this also shows the clock never ran.
        expect(result.success).toBe(false);
        expect(session.takeSnapshot()).toEqual(sampleSnapshot());
        expect(useGameStore().isTimerRunning).toBe(false);
      });

      it.each([
        ["the request fails", () => getNewPuzzle.mockResolvedValue({ success: false, status: 503 })],
        ["the response has no body", () => getNewPuzzle.mockResolvedValue({ success: true, status: 200 })],
        ["the service throws", () => getNewPuzzle.mockRejectedValue(new Error("boom"))],
      ])("clears the loading flag when %s", async (_, arrange) => {
        const session = useGameSession();
        arrange();

        await session.startNewPuzzle("hard");

        expect(useGameStore().loading).toBe(false);
      });

      it("returns a failure when the service throws", async () => {
        const session = useGameSession();
        getNewPuzzle.mockRejectedValue(new Error("boom"));

        const result = await session.startNewPuzzle("hard");

        expect(result).toEqual({
          success: false,
          status: 400,
          error: expect.stringContaining("boom"),
        });
      });
    });
  });

  describe("resumeSavedPuzzle", () => {
    function savedPuzzle(): sudokuService.SavedPuzzleResult {
      const cells = puzzleCells();
      cells[40].value = 5;
      return {
        puzzleId: "saved-1",
        cells,
        originalCells: puzzleCells(),
        actions: [{ isParent: true, cell: { idx: 40, value: 0, candidates: [] } }],
        elapsedSeconds: 600,
        difficultyRating: "easy",
        difficultyScore: 100,
      };
    }

    it("loads the saved game and saves it locally", async () => {
      const session = useGameSession();
      session.applySnapshot(sampleSnapshot());
      getSavedProgress.mockResolvedValue({ success: true, status: 200, body: savedPuzzle() });

      const result = await session.resumeSavedPuzzle("saved-1");
      const store = useGameStore();

      expect(getSavedProgress).toHaveBeenCalledExactlyOnceWith("saved-1");
      expect(result.success).toBe(true);
      expect(store.puzzleId).toBe("saved-1");
      expect(store.cells).toEqual(savedPuzzle().cells);
      expect(store.originalCells).toEqual(savedPuzzle().originalCells);
      expect(store.history).toEqual(savedPuzzle().actions);
      expect(store.redoActions).toEqual([]);
      expect(store.elapsedSeconds).toBe(600);
      expect(store.difficultyRating).toBe("easy");
      expect(store.difficultyScore).toBe(100);
      expect(store.loading).toBe(false);
      expect(storedSnapshot()?.puzzleId).toBe("saved-1");
    });

    it("sets the loading flag only while the request is in flight", async () => {
      let respond!: (r: Awaited<ReturnType<typeof getSavedProgress>>) => void;
      getSavedProgress.mockReturnValue(new Promise((r) => (respond = r)));
      const session = useGameSession();

      const pending = session.resumeSavedPuzzle("saved-1");
      expect(useGameStore().loading).toBe(true);

      respond({ success: true, status: 200, body: savedPuzzle() });
      await pending;
      expect(useGameStore().loading).toBe(false);
    });

    it.each([
      ["the request fails", { success: false as const, status: 404, error: "not found" }],
      ["the response has no body", { success: true as const, status: 200 }],
    ])("keeps the current game when %s", async (_, response) => {
      const session = useGameSession();
      session.applySnapshot(sampleSnapshot());
      getSavedProgress.mockResolvedValue(response);

      const result = await session.resumeSavedPuzzle("saved-1");

      expect(result.success).toBe(false);
      expect(session.takeSnapshot()).toEqual(sampleSnapshot());
    });

    it("returns a failure when the service throws", async () => {
      getSavedProgress.mockRejectedValue(new Error("boom"));

      const result = await useGameSession().resumeSavedPuzzle("saved-1");

      expect(result).toEqual({
        success: false,
        status: 400,
        error: expect.stringContaining("boom"),
      });
    });

    it.each([
      ["the request fails", () => getSavedProgress.mockResolvedValue({ success: false, status: 404 })],
      ["the response has no body", () => getSavedProgress.mockResolvedValue({ success: true, status: 200 })],
      ["the service throws", () => getSavedProgress.mockRejectedValue(new Error("boom"))],
    ])("clears the loading flag when %s", async (_, arrange) => {
      const session = useGameSession();
      arrange();

      await session.resumeSavedPuzzle("saved-1");

      expect(useGameStore().loading).toBe(false);
    });
  });
});
