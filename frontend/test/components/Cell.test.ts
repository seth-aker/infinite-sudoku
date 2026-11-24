import { beforeEach, describe, expect, it } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import Cell from "@/components/Cell.vue";
import { useGameStore } from "@/stores/gameStore";
import { PEERS } from "@/utils/puzzleUtils";

type Store = ReturnType<typeof useGameStore>;

function mountCell(idx: number, width = 40) {
  const store = useGameStore();
  return mount(Cell, { props: { cell: store.cells[idx]!, width } });
}

// The outer div's background shows whether the cell is selected, a peer of
// the selected cell, or neither.
function background(idx: number) {
  const classes = mountCell(idx).classes();
  if (classes.includes("bg-orange-400")) return "selected";
  if (classes.includes("bg-orange-200")) return "highlighted";
  if (classes.includes("bg-white")) return "plain";
  return "unknown";
}

function valueDiv(idx: number) {
  // The inner div holds the value (or the candidate grid).
  return mountCell(idx).find(".relative");
}

function visibleCandidates(idx: number) {
  return mountCell(idx)
    .findAll("span")
    .filter((s) => s.isVisible())
    .map((s) => Number(s.text()));
}

function place(store: Store, idx: number, value: number, given = false) {
  store.cells[idx]!.value = value;
  if (given) store.originalCells[idx]!.value = value;
}

describe("Cell", () => {
  let store: Store;
  beforeEach(() => {
    setActivePinia(createPinia());
    store = useGameStore();
  });

  it("sizes itself from the width prop", () => {
    const style = mountCell(0, 37).attributes("style");

    expect(style).toContain("width: 37px");
    expect(style).toContain("height: 37px");
  });

  describe("values", () => {
    it("shows a placed value", () => {
      place(store, 10, 6);

      expect(valueDiv(10).text()).toBe("6");
    });

    it("shows original clues in bold", () => {
      place(store, 10, 6, true);

      expect(valueDiv(10).classes()).toContain("font-bold");
    });

    it("shows the player's own values in normal weight", () => {
      place(store, 10, 6);

      expect(valueDiv(10).classes()).not.toContain("font-bold");
    });

    it.each([
      ["row", 10, 16],
      ["column", 10, 73],
      ["box", 10, 20],
    ])("shows a value in red when it repeats in the same %s", (_unit, idx, peer) => {
      place(store, idx, 4);
      place(store, peer, 4);

      expect(valueDiv(idx).classes()).toContain("text-red-600");
      expect(valueDiv(peer).classes()).toContain("text-red-600");
    });

    it("doesn't flag the same value outside the cell's row, column and box", () => {
      place(store, 10, 4);
      place(store, 80, 4);

      expect(valueDiv(10).classes()).not.toContain("text-red-600");
    });

    it("flags a clash with an original clue too", () => {
      place(store, 0, 4, true);
      place(store, 8, 4);

      expect(valueDiv(8).classes()).toContain("text-red-600");
    });
  });

  describe("candidates", () => {
    it("shows each candidate in its own slot of a 3x3 grid", () => {
      store.cells[10]!.candidates = [1, 5, 9];
      const slots = mountCell(10).findAll("span");

      expect(slots).toHaveLength(9);
      // Slot n always holds the digit n+1, so candidates keep a fixed position.
      slots.forEach((slot, i) => expect(slot.text()).toBe(String(i + 1)));
      expect(visibleCandidates(10)).toEqual([1, 5, 9]);
    });

    it("shows no candidates when there are none", () => {
      expect(visibleCandidates(10)).toEqual([]);
    });

    it("hides candidates once the cell has a value", () => {
      store.cells[10]!.candidates = [1, 5, 9];
      place(store, 10, 3);

      expect(mountCell(10).findAll("span")).toHaveLength(0);
      expect(valueDiv(10).text()).toBe("3");
    });
  });

  describe("highlighting", () => {
    it("leaves every cell plain when nothing is selected", () => {
      for (const idx of [0, 40, 80]) expect(background(idx)).toBe("plain");
    });

    // 0 and 80 are the first and last cells, so they catch off-by-one checks.
    describe.each([0, 40, 80])("when cell %i is selected", (selected) => {
      beforeEach(() => {
        store.selectedIdx = selected;
      });

      it("marks the selected cell", () => {
        expect(background(selected)).toBe("selected");
      });

      it("highlights every cell in its row, column and box", () => {
        const peers = PEERS[selected]!;
        expect(peers).toHaveLength(20);

        for (const peer of peers) expect(background(peer), `cell ${peer}`).toBe("highlighted");
      });

      it("leaves every other cell plain", () => {
        const others = [...Array(81).keys()].filter(
          (idx) => idx !== selected && !PEERS[selected]!.includes(idx),
        );

        for (const idx of others) expect(background(idx), `cell ${idx}`).toBe("plain");
      });
    });

    it("follows the selection as it moves", async () => {
      store.selectedIdx = 0;
      const w = mountCell(1);
      expect(w.classes()).toContain("bg-orange-200");

      store.selectedIdx = 80;
      await w.vm.$nextTick();

      expect(w.classes()).toContain("bg-white");
    });
  });
});
