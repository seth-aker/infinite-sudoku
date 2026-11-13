import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useGameStore } from "@/stores/gameStore";
import { useSudokuGame } from "@/composables/useSudokuGame";
import { cloneCell, createBlankCells } from "@/utils/puzzleUtils";

// useGameSession persists to localStorage and talks to the user store and clock;
// here we only care that the game asks for a save at the right moments.
const saveLocal = vi.fn();
const clearLocal = vi.fn();
vi.mock("@/composables/useGameSession", () => ({
  useGameSession: () => ({ saveLocal, clearLocal }),
}));

const GIVEN_IDX = 0; // a clue from the original puzzle
const GIVEN_VALUE = 7;

function setup() {
  const store = useGameStore();
  const original = createBlankCells();
  original[GIVEN_IDX].value = GIVEN_VALUE;
  store.originalCells = original;
  store.cells = original.map(cloneCell);
  return { store, game: useSudokuGame() };
}

describe("useSudokuGame", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    saveLocal.mockReset();
    clearLocal.mockReset();
  });

  describe("selectCell / togglePencil", () => {
    it("sets the selected index", () => {
      const { store, game } = setup();

      game.selectCell(42);

      expect(store.selectedIdx).toBe(42);
    });

    it("toggles pencil mode", () => {
      const { store, game } = setup();

      game.togglePencil();
      expect(store.usingPencil).toBe(true);
      game.togglePencil();
      expect(store.usingPencil).toBe(false);
    });
  });

  describe("getRow / getCol", () => {
    it("returns the store's cells for a row and a column", () => {
      const { store, game } = setup();

      expect(game.getRow(1)).toEqual(store.cells.slice(9, 18));
      expect(game.getCol(2).map((cell) => cell.idx)).toEqual([2, 11, 20, 29, 38, 47, 56, 65, 74]);
    });
  });

  describe("placeValue", () => {
    it("sets the value, records one undo step and saves", () => {
      const { store, game } = setup();

      game.placeValue(5, 40);

      expect(store.cells[40].value).toBe(5);
      expect(store.history).toEqual([{ isParent: true, cell: { idx: 40, value: 0, candidates: [] } }]);
      expect(saveLocal).toHaveBeenCalledOnce();
    });

    it("removes the value from peers' candidates and records each change", () => {
      const { store, game } = setup();
      store.cells[41].candidates = [3, 5]; // same row
      store.cells[4].candidates = [5]; // same column
      store.cells[30].candidates = [5, 9]; // same block
      store.cells[80].candidates = [5]; // not a peer

      game.placeValue(5, 40);

      expect(store.cells[41].candidates).toEqual([3]);
      expect(store.cells[4].candidates).toEqual([]);
      expect(store.cells[30].candidates).toEqual([9]);
      expect(store.cells[80].candidates).toEqual([5]);
      expect(store.history.filter((a) => !a.isParent).map((a) => a.cell)).toEqual(
        expect.arrayContaining([
          { idx: 41, value: 0, candidates: [3, 5] },
          { idx: 4, value: 0, candidates: [5] },
          { idx: 30, value: 0, candidates: [5, 9] },
        ]),
      );
      expect(store.history).toHaveLength(4);
    });

    it("clears the redo stack", () => {
      const { store, game } = setup();
      game.placeValue(5, 40);
      game.undo();
      expect(store.redoActions).not.toHaveLength(0);

      game.placeValue(6, 40);

      expect(store.redoActions).toEqual([]);
    });

    it("does not change a given cell", () => {
      const { store, game } = setup();

      game.placeValue(1, GIVEN_IDX);

      expect(store.cells[GIVEN_IDX].value).toBe(GIVEN_VALUE);
      expect(store.history).toEqual([]);
      expect(saveLocal).not.toHaveBeenCalled();
    });

    it.each([
      ["a value below 0", -1, 40],
      ["a value above 9", 10, 40],
      ["an index below 0", 5, -1],
      ["an index above 80", 5, 81],
    ])("ignores %s", (_, value, idx) => {
      const { store, game } = setup();

      expect(() => game.placeValue(value, idx)).not.toThrow();
      expect(store.history).toEqual([]);
      expect(saveLocal).not.toHaveBeenCalled();
    });
  });

  describe("clearCell", () => {
    it("clears the value when not in pencil mode", () => {
      const { store, game } = setup();
      store.cells[40].value = 5;
      store.cells[40].candidates = [1];

      game.clearCell(40);

      expect(store.cells[40]).toEqual({ idx: 40, value: 0, candidates: [1] });
      expect(store.history).toHaveLength(1);
      expect(saveLocal).toHaveBeenCalledOnce();
    });

    it("clears only the candidates in pencil mode", () => {
      const { store, game } = setup();
      store.usingPencil = true;
      store.cells[40].value = 5;
      store.cells[40].candidates = [1, 2];

      game.clearCell(40);

      expect(store.cells[40]).toEqual({ idx: 40, value: 5, candidates: [] });
    });

    it("does not change a given cell", () => {
      const { store, game } = setup();

      game.clearCell(GIVEN_IDX);

      expect(store.cells[GIVEN_IDX].value).toBe(GIVEN_VALUE);
      expect(store.history).toEqual([]);
    });
  });

  describe("toggleCandidate", () => {
    it("adds a candidate that is not there and removes one that is", () => {
      const { store, game } = setup();

      game.toggleCandidate(3, 40);
      game.toggleCandidate(8, 40);
      expect(store.cells[40].candidates).toEqual([3, 8]);

      game.toggleCandidate(3, 40);
      expect(store.cells[40].candidates).toEqual([8]);
      expect(store.history).toHaveLength(3);
      expect(saveLocal).toHaveBeenCalledTimes(3);
    });

    it("does not change a given cell", () => {
      const { store, game } = setup();

      game.toggleCandidate(3, GIVEN_IDX);

      expect(store.cells[GIVEN_IDX].candidates).toEqual([]);
      expect(store.history).toEqual([]);
    });
  });

  describe("undo / redo", () => {
    it("undoes a value placement along with the peer candidates it removed", () => {
      const { store, game } = setup();
      store.cells[41].candidates = [5];
      store.cells[30].candidates = [5, 9];
      const before = store.cells.map(cloneCell);

      game.placeValue(5, 40);
      game.undo();

      expect(store.cells).toEqual(before);
      expect(store.history).toEqual([]);
      expect(store.selectedIdx).toBe(40);
    });

    it("redo reapplies the whole placement", () => {
      const { store, game } = setup();
      store.cells[41].candidates = [5];
      store.cells[30].candidates = [5, 9];
      game.placeValue(5, 40);
      const after = store.cells.map(cloneCell);

      game.undo();
      game.redo();

      expect(store.cells).toEqual(after);
      expect(store.redoActions).toEqual([]);
      expect(store.selectedIdx).toBe(40);
    });

    it("undoes and redoes several moves one at a time, in order", () => {
      const { store, game } = setup();
      store.cells[41].candidates = [5];
      game.placeValue(5, 40); // move 1, also clears 41's candidate
      game.toggleCandidate(2, 80); // move 2
      game.placeValue(9, 10); // move 3
      const snapshots = [store.cells.map(cloneCell)];

      game.undo();
      snapshots.push(store.cells.map(cloneCell));
      expect(store.cells[10].value).toBe(0);
      expect(store.cells[80].candidates).toEqual([2]);

      game.undo();
      expect(store.cells[80].candidates).toEqual([]);
      expect(store.cells[40].value).toBe(5);

      game.redo();
      expect(store.cells).toEqual(snapshots[1]);
      game.redo();
      expect(store.cells).toEqual(snapshots[0]);
    });

    it("can undo back to the start and redo back to the end", () => {
      const { store, game } = setup();
      const start = store.cells.map(cloneCell);
      game.placeValue(1, 1);
      game.placeValue(2, 2);
      game.clearCell(1);
      const end = store.cells.map(cloneCell);

      game.undo();
      game.undo();
      game.undo();
      expect(store.cells).toEqual(start);

      game.redo();
      game.redo();
      game.redo();
      expect(store.cells).toEqual(end);
    });

    it("does nothing when there is nothing to undo or redo", () => {
      const { store, game } = setup();
      const before = store.cells.map(cloneCell);

      game.undo();
      game.redo();

      expect(store.cells).toEqual(before);
    });
  });

  describe("fillCandidates / clearCandidates", () => {
    it("fills each empty cell with the values none of its peers have", () => {
      const { store, game } = setup();
      store.cells[1].value = 3; // row peer of 0..8
      store.cells[40].value = 4;

      game.fillCandidates();

      expect(store.cells[2].candidates).toEqual([1, 2, 4, 5, 6, 8, 9]); // not 3 or the given 7
      expect(store.cells[80].candidates).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(store.cells[GIVEN_IDX].candidates).toEqual([]);
      expect(store.cells[40].candidates).toEqual([]);
    });

    it("does not duplicate candidates that are already there", () => {
      const { store, game } = setup();
      store.cells[80].candidates = [1, 9];

      game.fillCandidates();

      expect(store.cells[80].candidates).toHaveLength(9);
    });

    it("clearCandidates empties every cell's candidates", () => {
      const { store, game } = setup();
      game.fillCandidates();

      game.clearCandidates();

      expect(store.cells.every((cell) => cell.candidates.length === 0)).toBe(true);
    });

    it("setAutoCandidateMode fills on true, clears on false and saves", () => {
      const { store, game } = setup();

      game.setAutoCandidateMode(true);
      expect(store.autoCandidateMode).toBe(true);
      expect(store.cells[80].candidates).toHaveLength(9);

      game.setAutoCandidateMode(false);
      expect(store.autoCandidateMode).toBe(false);
      expect(store.cells[80].candidates).toEqual([]);
      expect(saveLocal).toHaveBeenCalledTimes(2);
    });
  });

  describe("resetBoard", () => {
    it("restores the original cells, clears the selection and saves", () => {
      const { store, game } = setup();
      game.placeValue(5, 40);
      game.selectCell(40);

      game.resetBoard();

      expect(store.cells).toEqual(store.originalCells);
      expect(store.selectedIdx).toBeUndefined();
      expect(clearLocal).toHaveBeenCalledOnce();
      expect(saveLocal).toHaveBeenCalled();
    });

    it("does not let later moves change the original puzzle", () => {
      const { store, game } = setup();
      game.resetBoard();

      game.placeValue(5, 40);

      expect(store.originalCells[40].value).toBe(0);
    });

    it("keeps reset cells editable", () => {
      const { store, game } = setup();
      game.resetBoard();

      game.placeValue(5, 40);
      game.placeValue(6, 40);

      expect(store.cells[40].value).toBe(6);
    });

    it("keeps undo and redo history", () => {
      const { store, game } = setup();
      game.placeValue(5, 40);
      game.placeValue(6, 41);
      game.undo();
      const history = JSON.parse(JSON.stringify(store.history));
      const redoActions = JSON.parse(JSON.stringify(store.redoActions));

      game.resetBoard();

      expect(store.history).toEqual(history);
      expect(store.redoActions).toEqual(redoActions);
    });
  });
});
