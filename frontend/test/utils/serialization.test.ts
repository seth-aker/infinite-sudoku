import { describe, expect, it } from "vitest";
import type { Action, Cell } from "@/stores/gameStore";
import {
  deserializeAction,
  deserializeCells,
  serializeAction,
  serializeCells,
} from "@/utils/serialization";

function blankCells(): Cell[] {
  return Array.from({ length: 81 }, (_, idx) => ({ idx, value: 0, candidates: [] }));
}

function action(idx: number, value: number, candidates: number[], isParent: boolean): Action {
  return { isParent, cell: { idx, value, candidates } };
}

describe("serialization", () => {
  describe("serializeCells", () => {
    it("writes one digit per cell value", () => {
      const cells = blankCells();
      cells[0].value = 5;
      cells[80].value = 9;

      const { cells: serialized } = serializeCells(cells);

      expect(serialized).toHaveLength(81);
      expect(serialized).toBe("5" + "0".repeat(79) + "9");
    });

    it("joins each cell's candidates and separates cells with ':'", () => {
      const cells = blankCells().slice(0, 3);
      cells[0].candidates = [1, 2, 3];
      cells[2].candidates = [9];

      expect(serializeCells(cells).candidates).toBe("123::9");
    });

    it("writes 80 separators and no candidates for a board with none", () => {
      expect(serializeCells(blankCells()).candidates).toBe(":".repeat(80));
    });

    it("returns empty strings for an empty board", () => {
      expect(serializeCells([])).toEqual({ cells: "", candidates: "" });
    });
  });

  describe("deserializeCells", () => {
    it("assigns each digit to the cell at that index", () => {
      const cells = deserializeCells({ cells: "120" });

      expect(cells).toEqual([
        { idx: 0, value: 1, candidates: [] },
        { idx: 1, value: 2, candidates: [] },
        { idx: 2, value: 0, candidates: [] },
      ]);
    });

    it("gives every cell empty candidates when candidates are omitted", () => {
      const cells = deserializeCells({ cells: "0".repeat(81) });

      expect(cells).toHaveLength(81);
      expect(cells.every((cell) => Array.isArray(cell.candidates) && cell.candidates.length === 0)).toBe(true);
    });

    it("parses candidates per cell", () => {
      const cells = deserializeCells({ cells: "000", candidates: "123::9" });

      expect(cells.map((cell) => cell.candidates)).toEqual([[1, 2, 3], [], [9]]);
    });

    it("gives every cell empty candidates when the candidates string is empty", () => {
      const cells = deserializeCells({ cells: "0".repeat(81), candidates: "" });

      expect(cells.every((cell) => Array.isArray(cell.candidates) && cell.candidates.length === 0)).toBe(true);
    });

    it("maps non-digit characters to -1", () => {
      const cells = deserializeCells({ cells: "1.x", candidates: "a2::" });

      expect(cells.map((cell) => cell.value)).toEqual([1, -1, -1]);
      expect(cells[0].candidates).toEqual([-1, 2]);
    });
  });

  describe("cells round trip", () => {
    it("restores values and candidates", () => {
      const cells = blankCells();
      cells[0].value = 4;
      cells[40].candidates = [1, 5, 9];
      cells[80].value = 9;
      cells[79].candidates = [1, 2, 3, 4, 5, 6, 7, 8, 9];

      expect(deserializeCells(serializeCells(cells))).toEqual(cells);
    });
  });

  describe("serializeAction", () => {
    // Layout: bits 0-6 index, 7-10 value, 11-19 candidate mask, 20 isParent.
    it.each([
      ["index only", action(80, 0, [], false), 80],
      ["value", action(0, 9, [], false), 9 << 7],
      ["lowest candidate", action(0, 0, [1], false), 1 << 11],
      ["highest candidate", action(0, 0, [9], false), 1 << 19],
      ["parent flag", action(0, 0, [], true), 1 << 20],
      [
        "every field at its maximum",
        action(80, 9, [1, 2, 3, 4, 5, 6, 7, 8, 9], true),
        (1 << 20) | (0b111111111 << 11) | (9 << 7) | 80,
      ],
    ])("encodes %s", (_, input, expected) => {
      expect(serializeAction(input)).toBe(expected);
    });

    it("treats a missing value as 0", () => {
      const input = { isParent: false, cell: { idx: 3, candidates: [] } } as unknown as Action;

      expect(serializeAction(input)).toBe(3);
    });
  });

  describe("deserializeAction", () => {
    it("decodes every field", () => {
      const encoded = (1 << 20) | (0b100000101 << 11) | (7 << 7) | 42;

      expect(deserializeAction(encoded)).toEqual(action(42, 7, [1, 3, 9], true));
    });

    it("returns candidates in ascending order without duplicates", () => {
      const encoded = serializeAction(action(0, 0, [9, 3, 3, 1], false));

      expect(deserializeAction(encoded).cell.candidates).toEqual([1, 3, 9]);
    });
  });

  describe("action round trip", () => {
    const cases: Action[] = [
      action(0, 0, [], false),
      action(80, 9, [], true),
      action(40, 0, [1, 2, 3, 4, 5, 6, 7, 8, 9], false),
      action(17, 5, [2, 8], true),
    ];

    it.each(cases)("restores %o", (input) => {
      expect(deserializeAction(serializeAction(input))).toEqual(input);
    });

    it("restores every index and value", () => {
      for (let idx = 0; idx < 81; idx++) {
        for (let value = 0; value <= 9; value++) {
          const input = action(idx, value, [], idx % 2 === 0);
          expect(deserializeAction(serializeAction(input))).toEqual(input);
        }
      }
    });
  });
});
