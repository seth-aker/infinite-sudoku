import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import SudokuControls from "@/components/SudokuControls.vue";
import { useGameStore } from "@/stores/gameStore";

// The game rules live in useSudokuGame and are tested there. These tests only
// check that each key press or click asks for the right action.
const game = {
  setAutoCandidateMode: vi.fn(),
  selectCell: vi.fn(),
  clearCell: vi.fn(),
  togglePencil: vi.fn(),
  undo: vi.fn(),
  redo: vi.fn(),
  placeValue: vi.fn(),
  toggleCandidate: vi.fn(),
};
vi.mock("@/composables/useSudokuGame", () => ({
  useSudokuGame: () => game,
}));

// Render icons as plain tags so buttons can be found by their icon.
vi.mock("@iconify/vue", async () => {
  const { defineComponent, h } = await import("vue");
  return {
    Icon: defineComponent({
      props: { icon: String },
      setup: (props) => () => h("i", { "data-icon": props.icon }),
    }),
  };
});

let wrapper: VueWrapper | undefined;

async function mountControls() {
  wrapper = mount(SudokuControls, {
    global: { stubs: { Numpad: true } },
    attachTo: document.body,
  });
  await flushPromises();
  return wrapper;
}

function press(key: string, init: KeyboardEventInit = {}) {
  window.dispatchEvent(new KeyboardEvent("keyup", { key, ...init }));
}

function buttonWithIcon(w: VueWrapper, icon: string) {
  return w.find(`[data-icon="${icon}"]`).element.closest("button")!;
}
const undoButton = (w: VueWrapper) => buttonWithIcon(w, "material-symbols:undo-rounded");
const redoButton = (w: VueWrapper) => buttonWithIcon(w, "material-symbols:redo-rounded");
const pencilToggle = (w: VueWrapper) => buttonWithIcon(w, "material-symbols:edit-outline-rounded");
const autoCandidateBox = (w: VueWrapper) =>
  w.find<HTMLButtonElement>('[role="checkbox"]').element;

function expectNoActions() {
  for (const fn of Object.values(game)) expect(fn).not.toHaveBeenCalled();
}

describe("SudokuControls", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    for (const fn of Object.values(game)) fn.mockReset();
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    document.body.innerHTML = "";
  });

  describe("keyboard: arrow keys", () => {
    it.each([
      ["ArrowUp", 40, 31],
      ["ArrowDown", 40, 49],
      ["ArrowLeft", 40, 39],
      ["ArrowRight", 40, 41],
    ])("%s from %i selects %i", async (key, from, to) => {
      useGameStore().selectedIdx = from;
      await mountControls();

      press(key);

      expect(game.selectCell).toHaveBeenCalledExactlyOnceWith(to);
    });

    it.each([
      // Up and Down wrap within the same column.
      ["ArrowUp", 0, 72],
      ["ArrowUp", 8, 80],
      ["ArrowDown", 72, 0],
      ["ArrowDown", 80, 8],
      // Left and Right wrap around the whole board, not within the row.
      ["ArrowLeft", 0, 80],
      ["ArrowRight", 80, 0],
      ["ArrowLeft", 9, 8],
      ["ArrowRight", 8, 9],
    ])("%s from %i wraps to %i", async (key, from, to) => {
      useGameStore().selectedIdx = from;
      await mountControls();

      press(key);

      expect(game.selectCell).toHaveBeenCalledExactlyOnceWith(to);
    });
  });

  describe("keyboard: entering values", () => {
    it.each(["1", "5", "9"])("places %s in the selected cell", async (key) => {
      useGameStore().selectedIdx = 30;
      await mountControls();

      press(key);

      expect(game.placeValue).toHaveBeenCalledExactlyOnceWith(Number(key), 30);
      expect(game.toggleCandidate).not.toHaveBeenCalled();
    });

    it("toggles a candidate instead when pencil mode is on", async () => {
      const store = useGameStore();
      store.selectedIdx = 30;
      store.usingPencil = true;
      await mountControls();

      press("4");

      expect(game.toggleCandidate).toHaveBeenCalledExactlyOnceWith(4, 30);
      expect(game.placeValue).not.toHaveBeenCalled();
    });

    it("clears the selected cell on Backspace", async () => {
      useGameStore().selectedIdx = 12;
      await mountControls();

      press("Backspace");

      expect(game.clearCell).toHaveBeenCalledExactlyOnceWith(12);
    });

    it.each(["a", "Enter", "Shift", "Tab", "F5", " "])(
      "ignores the %j key",
      async (key) => {
        useGameStore().selectedIdx = 12;
        await mountControls();

        press(key);

        expectNoActions();
      },
    );

    it("ignores arrows, digits and Backspace when no cell is selected", async () => {
      await mountControls();

      for (const key of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "5", "Backspace"]) {
        press(key);
      }

      expectNoActions();
    });
  });

  describe("keyboard: shortcuts", () => {
    beforeEach(() => {
      useGameStore().selectedIdx = 0;
    });

    it.each(["p", "P"])("toggles pencil mode on %j", async (key) => {
      await mountControls();

      press(key);

      expect(game.togglePencil).toHaveBeenCalledOnce();
    });

    it.each(["z", "Z"])("undoes on Ctrl+%s", async (key) => {
      await mountControls();

      press(key, { ctrlKey: true });

      expect(game.undo).toHaveBeenCalledOnce();
      expect(game.redo).not.toHaveBeenCalled();
    });

    it.each(["y", "Y"])("redoes on Ctrl+%s", async (key) => {
      await mountControls();

      press(key, { ctrlKey: true });

      expect(game.redo).toHaveBeenCalledOnce();
      expect(game.undo).not.toHaveBeenCalled();
    });

    it("does nothing for z or y pressed without Ctrl", async () => {
      await mountControls();

      press("z");
      press("y");

      expectNoActions();
    });
  });

  it("stops listening for keys once unmounted", async () => {
    useGameStore().selectedIdx = 40;
    const w = await mountControls();

    w.unmount();
    wrapper = undefined;
    press("ArrowUp");
    press("5");

    expectNoActions();
  });

  describe("buttons", () => {
    it("undo and redo buttons call undo and redo", async () => {
      const w = await mountControls();

      undoButton(w).click();
      redoButton(w).click();

      expect(game.undo).toHaveBeenCalledOnce();
      expect(game.redo).toHaveBeenCalledOnce();
    });

    it("the pencil toggle calls togglePencil", async () => {
      const w = await mountControls();

      pencilToggle(w).click();
      await flushPromises();

      expect(game.togglePencil).toHaveBeenCalledOnce();
    });

    it("the pencil toggle shows whether pencil mode is on", async () => {
      const store = useGameStore();
      const w = await mountControls();
      expect(pencilToggle(w).getAttribute("data-state")).toBe("off");

      store.usingPencil = true;
      await flushPromises();

      expect(pencilToggle(w).getAttribute("data-state")).toBe("on");
    });

    it("the auto-candidate checkbox turns the mode on and off", async () => {
      const store = useGameStore();
      const w = await mountControls();

      autoCandidateBox(w).click();
      await flushPromises();
      expect(game.setAutoCandidateMode).toHaveBeenLastCalledWith(true);

      // The checkbox follows the store, not its own internal state.
      store.autoCandidateMode = true;
      await flushPromises();
      expect(autoCandidateBox(w).getAttribute("data-state")).toBe("checked");

      autoCandidateBox(w).click();
      await flushPromises();
      expect(game.setAutoCandidateMode).toHaveBeenLastCalledWith(false);
      expect(game.setAutoCandidateMode).toHaveBeenCalledTimes(2);
    });

    it("disables every control while the game is paused", async () => {
      useGameStore().state = "paused";
      const w = await mountControls();

      for (const el of [undoButton(w), redoButton(w), pencilToggle(w), autoCandidateBox(w)]) {
        expect(el.disabled).toBe(true);
        el.click();
      }
      await flushPromises();

      expectNoActions();
    });

    it("enables every control while playing", async () => {
      useGameStore().state = "playing";
      const w = await mountControls();

      for (const el of [undoButton(w), redoButton(w), pencilToggle(w), autoCandidateBox(w)]) {
        expect(el.disabled).toBe(false);
      }
    });
  });

  it.each(["paused", "solved"] as const)("ignores the keyboard once the game is %s", async (state) => {
    const store = useGameStore();
    store.state = state;
    store.selectedIdx = 40;
    await mountControls();

    press("5");
    press("Backspace");
    press("ArrowUp");
    press("z", { ctrlKey: true });

    expectNoActions();
  });
});
