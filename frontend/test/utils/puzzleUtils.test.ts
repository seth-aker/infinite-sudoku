import { describe, expect, it } from "vitest";
import type { Cell } from "@/stores/gameStore";
import {
  PEERS,
  cellHasError,
  cloneCell,
  createBlankCells,
  getBlock,
  getCol,
  getPeers,
  getRow,
  isPuzzleSolved,
} from "@/utils/puzzleUtils";

// A valid completed grid, row by row.
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

function indexes(cells: Cell[]) {
  return cells.map((cell) => cell.idx);
}

describe("puzzleUtils", () => {
  describe("PEERS", () => {
    it("gives every cell exactly 20 peers", () => {
      expect(PEERS).toHaveLength(81);
      PEERS.forEach((peers) => expect(new Set(peers).size).toBe(20));
    });

    it("never lists a cell as its own peer", () => {
      PEERS.forEach((peers, idx) => expect(peers).not.toContain(idx));
    });

    it("is symmetric", () => {
      PEERS.forEach((peers, idx) => {
        peers.forEach((peer) => expect(PEERS[peer]).toContain(idx));
      });
    });

    it("contains the cell's row, column and block", () => {
      // Cell 40 is the centre: row 4, column 4, block 4.
      const expected = new Set([
        36, 37, 38, 39, 41, 42, 43, 44, // row
        4, 13, 22, 31, 49, 58, 67, 76, // column
        30, 32, 48, 50, // rest of block
      ]);

      expect(new Set(PEERS[40])).toEqual(expected);
    });
  });

  describe("getPeers", () => {
    it("returns the cell objects at the peer indexes", () => {
      const cells = createBlankCells();

      expect(indexes(getPeers(cells, 0))).toEqual([...PEERS[0]]);
      expect(getPeers(cells, 0)[0]).toBe(cells[PEERS[0][0]]);
    });
  });

  describe("getRow / getCol / getBlock", () => {
    const cells = createBlankCells();

    it.each([
      [0, [0, 1, 2, 3, 4, 5, 6, 7, 8]],
      [8, [72, 73, 74, 75, 76, 77, 78, 79, 80]],
    ])("getRow(%i)", (row, expected) => {
      expect(indexes(getRow(cells, row))).toEqual(expected);
    });

    it.each([
      [0, [0, 9, 18, 27, 36, 45, 54, 63, 72]],
      [8, [8, 17, 26, 35, 44, 53, 62, 71, 80]],
    ])("getCol(%i)", (col, expected) => {
      expect(indexes(getCol(cells, col))).toEqual(expected);
    });

    it.each([
      [0, [0, 1, 2, 9, 10, 11, 18, 19, 20]],
      [4, [30, 31, 32, 39, 40, 41, 48, 49, 50]],
      [5, [33, 34, 35, 42, 43, 44, 51, 52, 53]],
      [8, [60, 61, 62, 69, 70, 71, 78, 79, 80]],
    ])("getBlock(%i)", (block, expected) => {
      expect(indexes(getBlock(cells, block))).toEqual(expected);
    });

    it("covers every cell exactly once across all rows, columns and blocks", () => {
      for (const getter of [getRow, getCol, getBlock]) {
        const all = Array.from({ length: 9 }, (_, i) => indexes(getter(cells, i))).flat();
        expect(all.sort((a, b) => a - b)).toEqual([...Array(81).keys()]);
      }
    });
  });

  describe("cellHasError", () => {
    it("is false for an empty cell", () => {
      const cells = createBlankCells();
      cells[1].value = 5; // a peer has a value, but the cell itself is empty

      expect(cellHasError(cells, 0)).toBe(false);
    });

    it("is false when no peer shares the value", () => {
      expect(cellHasError(cellsFrom(SOLVED), 40)).toBe(false);
    });

    it.each([
      ["row", 8],
      ["column", 72],
      ["block", 20],
    ])("is true when a %s peer shares the value", (_, peer) => {
      const cells = createBlankCells();
      cells[0].value = 3;
      cells[peer].value = 3;

      expect(cellHasError(cells, 0)).toBe(true);
      expect(cellHasError(cells, peer)).toBe(true);
    });

    it("ignores matching values outside the cell's row, column and block", () => {
      const cells = createBlankCells();
      cells[0].value = 3;
      cells[40].value = 3;

      expect(cellHasError(cells, 0)).toBe(false);
    });
  });

  describe("isPuzzleSolved", () => {
    it("is true for a valid completed grid", () => {
      expect(isPuzzleSolved(cellsFrom(SOLVED))).toBe(true);
    });

    it("is false when any cell is empty", () => {
      const cells = cellsFrom(SOLVED);
      cells[80].value = 0;

      expect(isPuzzleSolved(cells)).toBe(false);
    });

    it("is false when the grid is full but has a conflict", () => {
      // Swapping two cells in one row keeps the row valid but breaks their columns.
      const cells = cellsFrom(SOLVED);
      [cells[0].value, cells[1].value] = [cells[1].value, cells[0].value];

      expect(isPuzzleSolved(cells)).toBe(false);
    });

    it.each([
      ["an empty array", []],
      ["too few cells", cellsFrom(SOLVED).slice(0, 80)],
    ])("is false for %s", (_, cells) => {
      expect(isPuzzleSolved(cells)).toBe(false);
    });

    it("is false for a missing board", () => {
      expect(isPuzzleSolved(undefined as unknown as Cell[])).toBe(false);
    });
  });

  describe("createBlankCells", () => {
    it("creates 81 empty cells with matching indexes", () => {
      const cells = createBlankCells();

      expect(cells).toHaveLength(81);
      cells.forEach((cell, idx) => expect(cell).toEqual({ idx, value: 0, candidates: [] }));
    });

    it("does not share candidate arrays between cells", () => {
      const cells = createBlankCells();
      cells[0].candidates.push(1);

      expect(cells[1].candidates).toEqual([]);
    });
  });

  describe("cloneCell", () => {
    it("copies the cell without sharing the candidates array", () => {
      const original: Cell = { idx: 12, value: 0, candidates: [2, 7] };

      const copy = cloneCell(original);
      copy.candidates.push(9);

      expect(copy).not.toBe(original);
      expect(original.candidates).toEqual([2, 7]);
      expect(copy).toEqual({ idx: 12, value: 0, candidates: [2, 7, 9] });
    });
  });
});
