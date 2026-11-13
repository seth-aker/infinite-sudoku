import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useGameStore, type Cell } from "@/stores/gameStore";
import { useUserStore } from "@/stores/userStore";
import { useGameSession, type GameSnapshot } from "@/composables/useGameSession";
import * as sudokuService from "@/services/sudokuService";
import { createBlankCells } from "@/utils/puzzleUtils";

vi.mock("@/services/sudokuService", () => ({
  getNewPuzzle: vi.fn(),
  getSavedProgress: vi.fn(),
  saveProgress: vi.fn(),
}));

// The real clock keeps a module-level interval tied to the first store it sees,
// so it is replaced with spies; it has its own concerns to test separately.
const clock = { start: vi.fn(), pause: vi.fn(), halt: vi.fn(), reset: vi.fn() };
vi.mock("@/composables/useGameClock", () => ({
  useGameClock: () => clock,
}));

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
    setActivePinia(createPinia());
    localStorage.clear();
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("local snapshots", () => {
    it("applySnapshot followed by takeSnapshot returns the same game", () => {
      const session = useGameSession();
      const snapshot = sampleSnapshot();

      session.applySnapshot(snapshot);

      expect(session.takeSnapshot()).toEqual(snapshot);
    });

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
      expect(clock.reset).toHaveBeenCalledOnce();
      expect(clock.start).toHaveBeenCalledOnce();
      expect(storedSnapshot()?.puzzleId).toBe("new-1");
    });

    it("keeps the board and the original puzzle separate", async () => {
      const session = useGameSession();
      getNewPuzzle.mockResolvedValue({ success: true, status: 200, body: newPuzzle() });
      await session.startNewPuzzle("hard");
      const store = useGameStore();

      store.cells[40].value = 5;

      expect(store.originalCells[40].value).toBe(0);
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

        expect(result.success).toBe(false);
        expect(session.takeSnapshot()).toEqual(sampleSnapshot());
        expect(clock.start).not.toHaveBeenCalled();
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
