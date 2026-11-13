import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useGameStore, type Cell } from "@/stores/gameStore";
import { createBlankCells } from "@/utils/puzzleUtils";

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

function filledCells(count: number): Cell[] {
  const cells = createBlankCells();
  for (let i = 0; i < count; i++) cells[i].value = 1;
  return cells;
}

describe("gameStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  describe("initial state", () => {
    it("starts idle with a blank board", () => {
      const store = useGameStore();

      expect(store.state).toBe("idle");
      expect(store.elapsedSeconds).toBe(0);
      expect(store.cells).toEqual(createBlankCells());
      expect(store.originalCells).toEqual(createBlankCells());
      expect(store.history).toEqual([]);
      expect(store.redoActions).toEqual([]);
    });
  });

  describe("formattedTime", () => {
    it.each([
      [0, "0:00"],
      [5, "0:05"],
      [59, "0:59"],
      [60, "1:00"],
      [125, "2:05"],
      [600, "10:00"],
      [3599, "59:59"],
      [3600, "1:00:00"],
      [3665, "1:01:05"],
      [4200, "1:10:00"],
      [36000, "10:00:00"],
    ])("formats %i seconds as %s", (seconds, expected) => {
      const store = useGameStore();

      store.elapsedSeconds = seconds;

      expect(store.formattedTime).toBe(expected);
    });

    it("updates as the clock ticks", () => {
      const store = useGameStore();
      store.elapsedSeconds = 59;
      expect(store.formattedTime).toBe("0:59");

      store.elapsedSeconds++;

      expect(store.formattedTime).toBe("1:00");
    });
  });

  describe("isSolved", () => {
    it("is false for a blank board", () => {
      expect(useGameStore().isSolved).toBe(false);
    });

    it("is true for a valid completed board", () => {
      const store = useGameStore();

      store.cells = cellsFrom(SOLVED);

      expect(store.isSolved).toBe(true);
    });

    it("updates when a single cell changes", () => {
      const store = useGameStore();
      store.cells = cellsFrom(SOLVED);

      store.cells[40].value = 0;
      expect(store.isSolved).toBe(false);

      store.cells[40].value = Number(SOLVED[40]);
      expect(store.isSolved).toBe(true);
    });
  });

  describe("progressPercent", () => {
    it.each([
      [0, 0],
      [1, 1], // 1.23%
      [40, 49], // 49.38%
      [41, 51], // 50.62%
      [80, 99], // 98.77%
      [81, 100],
    ])("is %i filled cells -> %i%%", (filled, expected) => {
      const store = useGameStore();

      store.cells = filledCells(filled);

      expect(store.progressPercent).toBe(expected);
    });

    it("updates when a single cell changes", () => {
      const store = useGameStore();
      store.cells[0].value = 5;

      expect(store.progressPercent).toBe(1);
    });
  });

  describe("$reset", () => {
    it("restores every field to its initial value", () => {
      const store = useGameStore();
      const initial = JSON.parse(JSON.stringify(store.$state));
      store.state = "playing";
      store.loading = true;
      store.elapsedSeconds = 300;
      store.puzzleId = "abc";
      store.cells = cellsFrom(SOLVED);
      store.originalCells = cellsFrom(SOLVED);
      store.difficultyRating = "hard";
      store.difficultyScore = 420;
      store.usingPencil = true;
      store.selectedIdx = 40;
      store.history = [{ isParent: true, cell: { idx: 0, value: 0, candidates: [] } }];
      store.redoActions = [{ isParent: true, cell: { idx: 1, value: 0, candidates: [] } }];
      store.autoCandidateMode = true;

      store.$reset();

      expect(JSON.parse(JSON.stringify(store.$state))).toEqual(initial);
      expect(store.puzzleId).toBeUndefined();
      expect(store.difficultyRating).toBeUndefined();
      expect(store.selectedIdx).toBeUndefined();
    });

    it("gives the board and the original puzzle separate cells", () => {
      const store = useGameStore();
      store.$reset();

      store.cells[0].value = 5;

      expect(store.originalCells[0].value).toBe(0);
    });

    it("resets the derived values", () => {
      const store = useGameStore();
      store.cells = cellsFrom(SOLVED);
      store.elapsedSeconds = 3665;

      store.$reset();

      expect(store.isSolved).toBe(false);
      expect(store.progressPercent).toBe(0);
      expect(store.formattedTime).toBe("0:00");
    });
  });
});
