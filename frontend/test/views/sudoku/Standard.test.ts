import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import { toast } from "vue-sonner";
import Standard from "@/views/sudoku/Standard.vue";
import { useGameStore, type Cell, type DifficultyRating } from "@/stores/gameStore";
import { useUserStore } from "@/stores/userStore";
import { useDialog } from "@/composables/useDialog";
import { useGameSession } from "@/composables/useGameSession";
import type { GameSnapshot } from "@/validation/localStorage";
import * as sudokuService from "@/services/sudokuService";
import { createBlankCells } from "@/utils/puzzleUtils";

// Only the network, router and toast boundaries are mocked. The stores, session,
// clock and game logic run for real so these tests check what the player sees.
vi.mock("@/services/sudokuService", () => ({
  getNewPuzzle: vi.fn(),
  getSavedProgress: vi.fn(),
  saveProgress: vi.fn(),
}));

const guards = vi.hoisted(() => ({
  leave: undefined as undefined | (() => unknown),
  update: undefined as undefined | ((to: { params: Record<string, unknown> }) => unknown),
}));
const router = vi.hoisted(() => ({ push: vi.fn() }));
// The page's route; mountGame points it at the difficulty being mounted.
const route = vi.hoisted(() => ({ params: {} as Record<string, unknown> }));
vi.mock("vue-router", () => ({
  useRouter: () => router,
  useRoute: () => route,
  onBeforeRouteLeave: (fn: () => unknown) => (guards.leave = fn),
  onBeforeRouteUpdate: (fn: (to: { params: Record<string, unknown> }) => unknown) =>
    (guards.update = fn),
}));
// The real router module builds a browser router and imports every view.
vi.mock("@/router", () => ({
  PUZZLE_DIFFICULTY_ROUTES: ["beginner", "easy", "medium", "hard"],
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

const getNewPuzzle = vi.mocked(sudokuService.getNewPuzzle);
const saveProgress = vi.mocked(sudokuService.saveProgress);

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

function newPuzzle(difficulty: DifficultyRating, puzzleId = "new-1") {
  return {
    success: true as const,
    status: 200,
    body: { puzzleId, cells: puzzleCells(), difficultyRating: difficulty, difficultyScore: 100 },
  };
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

function storedGame(): GameSnapshot {
  return JSON.parse(localStorage.getItem(SESSION_KEY)!);
}

// A game saved by an earlier visit or before a page refresh. It's written by the
// app's own saveLocal on a throwaway store, so it always has the current format.
function savedGame(overrides: Partial<GameSnapshot> = {}) {
  setActivePinia(createPinia());
  const session = useGameSession();
  session.applySnapshot(localGame(overrides));
  session.saveLocal();
  setActivePinia(pinia);
}

// A game already in memory with nothing saved, e.g. HomeView reset the store.
function gameInStore(overrides: Partial<GameSnapshot> = {}) {
  useGameSession().applySnapshot(localGame(overrides));
}

function signIn() {
  useUserStore().set({ id: "user-1", email: "a@b.c", role: "user" });
}

// Stubs keep the markup plain: dialogs render inline only while open, and the
// pause menu just exposes the props and events Standard.vue drives it with.
const Passthrough = defineComponent({
  setup: (_, { slots }) => () => h("div", slots.default?.()),
});
const stubs = {
  Dialog: defineComponent({
    props: { open: Boolean },
    setup: (props, { slots }) => () =>
      props.open ? h("div", { "data-test": "complete-dialog" }, slots.default?.()) : null,
  }),
  DialogContent: Passthrough,
  DialogHeader: Passthrough,
  DialogTitle: Passthrough,
  DialogDescription: Passthrough,
  DialogFooter: Passthrough,
  DialogClose: Passthrough,
  Button: defineComponent({
    setup: (_, { slots, attrs }) => () => h("button", attrs, slots.default?.()),
  }),
  PauseMenu: defineComponent({
    name: "PauseMenu",
    props: { open: Boolean },
    emits: ["resume"],
    setup: (props) => () => h("div", { "data-test": "pause-menu", "data-open": String(props.open) }),
  }),
  LoadingOverlay: defineComponent({
    setup: () => () => h("div", { "data-test": "loading" }),
  }),
  ErrorDialog: true,
  SudokuPuzzle: true,
  SudokuControls: true,
  ControlInstructions: true,
};

let pinia: Pinia;
let wrapper: VueWrapper | undefined;

async function mountGame(difficulty: DifficultyRating = "easy") {
  route.params = { difficulty };
  wrapper = mount(Standard, { props: { difficulty }, global: { plugins: [pinia], stubs } });
  await flushPromises();
  return wrapper;
}

function timerButton(w: VueWrapper) {
  return w.findAll("button").find((b) => b.find("[data-icon]").exists())!;
}
function timerIcon(w: VueWrapper) {
  return w.find("[data-icon]").attributes("data-icon");
}
function buttonWithText(w: VueWrapper, text: string) {
  return w.findAll("button").find((b) => b.text().trim() === text)!;
}
function isDisabled(button: { attributes: (k: string) => string | undefined }) {
  return button.attributes("disabled") !== undefined;
}
function pauseMenuOpen(w: VueWrapper) {
  return w.find('[data-test="pause-menu"]').attributes("data-open") === "true";
}
// Clicks a button in the app-wide dialog the way AppDialog does: wait for
// onClick, then close if closeOnClick is set.
async function clickDialogButton(text: string) {
  const btn = dialogButton(text);
  await btn.onClick?.();
  if (btn.closeOnClick) useDialog().closeDialog();
  await flushPromises();
}
function fetchErrorShown() {
  return useDialog().isOpen.value && useDialog().dialogState.value?.title === "Error Fetching Puzzle";
}
function completeDialogOpen(w: VueWrapper) {
  return w.find('[data-test="complete-dialog"]').exists();
}
async function solve() {
  useGameStore().cells = cellsFrom(SOLVED);
  await flushPromises();
}
function dialogButton(text: string) {
  return useDialog().dialogState.value!.buttons.find((b) => b.text === text)!;
}

describe("Standard.vue", () => {
  beforeEach(() => {
    // Promises are left real so flushPromises still works.
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"],
    });
    pinia = createPinia();
    setActivePinia(pinia);
    localStorage.clear();
    vi.clearAllMocks();
    useDialog().closeDialog();
    getNewPuzzle.mockImplementation(async (difficulty) => newPuzzle(difficulty));
    saveProgress.mockResolvedValue({ success: true, status: 204 });
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.useRealTimers();
  });

  describe("on mount", () => {
    it("starts a new puzzle of the route's difficulty when there is no game in progress", async () => {
      await mountGame("hard");
      const store = useGameStore();

      expect(getNewPuzzle).toHaveBeenCalledExactlyOnceWith("hard");
      expect(store.puzzleId).toBe("new-1");
      expect(store.state).toBe("playing");
      expect(store.isTimerRunning).toBe(true);
      expect(store.loading).toBe(false);
    });

    it("restores the saved game after a page refresh", async () => {
      savedGame({ state: "paused" });

      await mountGame("easy");
      const store = useGameStore();

      expect(getNewPuzzle).not.toHaveBeenCalled();
      expect(store.puzzleId).toBe("local-1");
      expect(store.elapsedSeconds).toBe(300);
      expect(store.cells[40].value).toBe(3);
    });

    it("opens a restored paused game on the pause menu with the clock stopped", async () => {
      savedGame({ state: "paused" });

      const w = await mountGame("easy");
      vi.advanceTimersByTime(3000);

      expect(useGameStore().isTimerRunning).toBe(false);
      expect(useGameStore().elapsedSeconds).toBe(300);
      expect(pauseMenuOpen(w)).toBe(true);
    });

    it("resumes a restored game that was playing", async () => {
      savedGame({ state: "playing" });

      const w = await mountGame("easy");
      vi.advanceTimersByTime(2000);
      await flushPromises();
      const store = useGameStore();

      expect(store.state).toBe("playing");
      expect(store.isTimerRunning).toBe(true);
      expect(store.elapsedSeconds).toBe(302);
      expect(timerIcon(w)).toBe("material-symbols:pause-rounded");
      expect(pauseMenuOpen(w)).toBe(false);
    });

    it("does not start the clock for an idle game left in the store", async () => {
      gameInStore({ state: "idle" });

      await mountGame("easy");
      vi.advanceTimersByTime(2000);

      expect(useGameStore().isTimerRunning).toBe(false);
      expect(useGameStore().elapsedSeconds).toBe(300);
    });

    it("continues a game already in the store when nothing is saved", async () => {
      gameInStore();

      await mountGame("easy");

      expect(getNewPuzzle).not.toHaveBeenCalled();
      expect(useGameStore().puzzleId).toBe("local-1");
    });

    it("replaces a saved game of a different difficulty", async () => {
      savedGame({ difficultyRating: "easy" });

      await mountGame("hard");
      const store = useGameStore();

      expect(getNewPuzzle).toHaveBeenCalledExactlyOnceWith("hard");
      expect(store.puzzleId).toBe("new-1");
      expect(store.elapsedSeconds).toBe(0);
      expect(storedGame().puzzleId).toBe("new-1");
    });

    it("keeps a restored solved game solved with the clock stopped", async () => {
      savedGame({ cells: cellsFrom(SOLVED), state: "solved" });

      await mountGame("easy");
      vi.advanceTimersByTime(3000);
      const store = useGameStore();

      expect(store.state).toBe("solved");
      expect(store.isTimerRunning).toBe(false);
      expect(store.elapsedSeconds).toBe(300);
    });

    it("keeps a solved game left in the store solved with the clock stopped", async () => {
      gameInStore({ cells: cellsFrom(SOLVED), state: "solved" });

      await mountGame("easy");
      vi.advanceTimersByTime(3000);
      const store = useGameStore();

      expect(store.state).toBe("solved");
      expect(store.isTimerRunning).toBe(false);
      expect(store.elapsedSeconds).toBe(300);
    });

    it("shows the loading overlay until the puzzle arrives", async () => {
      let resolve!: (v: ReturnType<typeof newPuzzle>) => void;
      getNewPuzzle.mockReturnValue(new Promise((r) => (resolve = r)));

      route.params = { difficulty: "easy" };
      wrapper = mount(Standard, { props: { difficulty: "easy" }, global: { plugins: [pinia], stubs } });
      await flushPromises();
      expect(wrapper.find('[data-test="loading"]').exists()).toBe(true);

      resolve(newPuzzle("easy"));
      await flushPromises();
      expect(wrapper.find('[data-test="loading"]').exists()).toBe(false);
    });

    it("shows the loading overlay while the user is loading", async () => {
      const w = await mountGame();

      useUserStore().loading = true;
      await flushPromises();

      expect(w.find('[data-test="loading"]').exists()).toBe(true);
    });
  });

  describe("when the puzzle cannot be fetched on mount", () => {
    beforeEach(() => {
      getNewPuzzle.mockResolvedValue({ success: false, status: 503, error: "Server down" });
    });

    it("shows the server's error with Retry and Cancel", async () => {
      const w = await mountGame();
      const dialog = useDialog().dialogState.value;

      expect(fetchErrorShown()).toBe(true);
      expect(dialog?.message).toBe("Server down");
      expect(dialog?.buttons.map((b) => b.text)).toEqual(["Retry", "Cancel"]);
      expect(w.find('[data-test="loading"]').exists()).toBe(false);
    });

    it("falls back to the status code when the server gives no message", async () => {
      getNewPuzzle.mockResolvedValue({ success: false, status: 503 });

      await mountGame();

      expect(useDialog().dialogState.value?.message).toBe("Error code: 503");
    });

    it("does not start the clock or show a board", async () => {
      const w = await mountGame();
      vi.advanceTimersByTime(3000);
      const store = useGameStore();

      expect(store.isTimerRunning).toBe(false);
      expect(store.elapsedSeconds).toBe(0);
      expect(store.state).toBe("idle");
      expect(w.findComponent({ name: "SudokuPuzzle" }).exists()).toBe(false);
    });

    it("hides the controls and disables the timer and Reset buttons", async () => {
      const w = await mountGame();

      expect(w.findComponent({ name: "SudokuControls" }).exists()).toBe(false);
      expect(isDisabled(timerButton(w))).toBe(true);
      expect(isDisabled(buttonWithText(w, "Reset"))).toBe(true);
    });

    it("offers only Retry and Cancel when no other game is saved", async () => {
      await mountGame();

      expect(useDialog().dialogState.value?.buttons.map((b) => b.text)).toEqual(["Retry", "Cancel"]);
    });

    it("Retry loads the puzzle, starts the clock and closes the error", async () => {
      const w = await mountGame();
      getNewPuzzle.mockResolvedValue(newPuzzle("easy"));

      await clickDialogButton("Retry");
      vi.advanceTimersByTime(1000);
      const store = useGameStore();

      expect(getNewPuzzle).toHaveBeenCalledTimes(2);
      expect(getNewPuzzle).toHaveBeenLastCalledWith("easy");
      expect(store.puzzleId).toBe("new-1");
      expect(store.state).toBe("playing");
      expect(store.elapsedSeconds).toBe(1);
      expect(store.loading).toBe(false);
      expect(fetchErrorShown()).toBe(false);
      expect(w.findComponent({ name: "SudokuPuzzle" }).exists()).toBe(true);
      expect(w.findComponent({ name: "SudokuControls" }).exists()).toBe(true);
      expect(isDisabled(timerButton(w))).toBe(false);
      expect(isDisabled(buttonWithText(w, "Reset"))).toBe(false);
    });

    // Retry closes its own dialog first; with closeOnClick, AppDialog would close
    // the new error dialog that a second failure opens.
    it("shows the error again when Retry also fails", async () => {
      await mountGame();

      await clickDialogButton("Retry");

      expect(getNewPuzzle).toHaveBeenCalledTimes(2);
      expect(fetchErrorShown()).toBe(true);
    });

    it("Cancel closes the error and goes home", async () => {
      await mountGame();

      await clickDialogButton("Cancel");
      vi.advanceTimersByTime(3000);
      const store = useGameStore();

      expect(fetchErrorShown()).toBe(false);
      expect(router.push).toHaveBeenCalledExactlyOnceWith({ name: "home" });
      expect(getNewPuzzle).toHaveBeenCalledOnce();
      expect(store.state).toBe("idle");
      expect(store.isTimerRunning).toBe(false);
    });
  });

  describe("when a game of another difficulty is saved and the fetch fails", () => {
    beforeEach(() => {
      savedGame({ difficultyRating: "easy", state: "playing" });
      getNewPuzzle.mockResolvedValue({ success: false, status: 503, error: "Server down" });
    });

    it("does not show or let the player use the other game's board", async () => {
      const w = await mountGame("hard");

      expect(w.findComponent({ name: "SudokuPuzzle" }).exists()).toBe(false);
      expect(w.findComponent({ name: "SudokuControls" }).exists()).toBe(false);
      expect(isDisabled(timerButton(w))).toBe(true);
      expect(isDisabled(buttonWithText(w, "Reset"))).toBe(true);
      expect(useGameStore().isTimerRunning).toBe(false);
    });

    // Intended: the header keeps showing the saved game's time next to the
    // route's difficulty.
    it("shows the saved game's time in the header", async () => {
      const w = await mountGame("hard");

      expect(w.text()).toContain("Hard");
      expect(w.text()).toContain("5:00");
    });

    it("offers to go back to the saved game", async () => {
      await mountGame("hard");

      expect(useDialog().dialogState.value?.buttons.map((b) => b.text)).toEqual([
        "Retry",
        "Back to easy game",
        "Cancel",
      ]);

      await clickDialogButton("Back to easy game");

      expect(router.push).toHaveBeenCalledExactlyOnceWith({
        name: "sudoku",
        params: { difficulty: "easy" },
      });
      expect(fetchErrorShown()).toBe(false);
    });

    it("leaves the saved game intact", async () => {
      const w = await mountGame("hard");
      vi.advanceTimersByTime(5000);

      w.unmount();
      wrapper = undefined;

      expect(storedGame()).toEqual({
        version: expect.any(Number),
        ...localGame({ difficultyRating: "easy", state: "playing" }),
      });
    });

    // Otherwise Resume would start the hidden game's clock and its per-second save.
    it("does not open the pause menu for the other game", async () => {
      savedGame({ difficultyRating: "easy", state: "paused" });

      const w = await mountGame("hard");

      expect(pauseMenuOpen(w)).toBe(false);
    });

    it("Retry replaces it once the fetch works", async () => {
      const w = await mountGame("hard");
      getNewPuzzle.mockResolvedValue(newPuzzle("hard"));

      await clickDialogButton("Retry");

      expect(useGameStore().puzzleId).toBe("new-1");
      expect(w.findComponent({ name: "SudokuPuzzle" }).exists()).toBe(true);
      expect(storedGame().difficultyRating).toBe("hard");
    });
  });

  describe("clock", () => {
    it("shows the time as it counts", async () => {
      const w = await mountGame();

      vi.advanceTimersByTime(65_000);
      await flushPromises();

      expect(w.text()).toContain("1:05");
    });

    it("saves the game locally every second", async () => {
      await mountGame();

      vi.advanceTimersByTime(1000);
      await flushPromises();
      expect(storedGame().elapsedSeconds).toBe(1);

      vi.advanceTimersByTime(1000);
      await flushPromises();
      expect(storedGame().elapsedSeconds).toBe(2);
    });

    it("the timer button pauses the game and opens the pause menu", async () => {
      const w = await mountGame();
      expect(timerIcon(w)).toBe("material-symbols:pause-rounded");
      expect(pauseMenuOpen(w)).toBe(false);

      await timerButton(w).trigger("click");
      vi.advanceTimersByTime(3000);
      const store = useGameStore();

      expect(store.state).toBe("paused");
      expect(store.elapsedSeconds).toBe(0);
      expect(timerIcon(w)).toBe("material-symbols:play-arrow-rounded");
      expect(pauseMenuOpen(w)).toBe(true);
    });

    it("the timer button resumes a paused game", async () => {
      const w = await mountGame();
      await timerButton(w).trigger("click");

      await timerButton(w).trigger("click");
      vi.advanceTimersByTime(2000);
      await flushPromises();

      expect(useGameStore().state).toBe("playing");
      expect(useGameStore().elapsedSeconds).toBe(2);
      expect(timerIcon(w)).toBe("material-symbols:pause-rounded");
      expect(pauseMenuOpen(w)).toBe(false);
    });

    // Only the disabled state is checked: test-utils (like a browser) drops
    // clicks on a disabled button, so clicking it here would prove nothing.
    it("disables the timer button once the puzzle is solved", async () => {
      const w = await mountGame();
      expect(timerButton(w).attributes("disabled")).toBeUndefined();

      await solve();

      expect(timerButton(w).attributes("disabled")).toBeDefined();
    });

    it("resuming from the pause menu restarts the clock and closes the menu", async () => {
      const w = await mountGame();
      await timerButton(w).trigger("click");

      w.findComponent({ name: "PauseMenu" }).vm.$emit("resume");
      await flushPromises();
      vi.advanceTimersByTime(2000);

      expect(useGameStore().state).toBe("playing");
      expect(useGameStore().elapsedSeconds).toBe(2);
      expect(pauseMenuOpen(w)).toBe(false);
    });
  });

  describe("reset", () => {
    it("stops the clock and asks for confirmation without opening the pause menu", async () => {
      const w = await mountGame();

      await buttonWithText(w, "Reset").trigger("click");
      vi.advanceTimersByTime(3000);

      expect(useGameStore().isTimerRunning).toBe(false);
      expect(useGameStore().elapsedSeconds).toBe(0);
      expect(useDialog().isOpen.value).toBe(true);
      expect(useDialog().dialogState.value?.title).toBe("Reset Board");
      expect(pauseMenuOpen(w)).toBe(false);
    });

    it("cancel leaves the board alone and restarts the clock", async () => {
      const w = await mountGame();
      const store = useGameStore();
      store.cells[40].value = 3;
      await buttonWithText(w, "Reset").trigger("click");

      dialogButton("Cancel").onClick!();
      vi.advanceTimersByTime(1000);

      expect(store.cells[40].value).toBe(3);
      expect(store.isTimerRunning).toBe(true);
      expect(store.elapsedSeconds).toBe(1);
    });

    it("cancel on a solved puzzle keeps it solved with the clock stopped", async () => {
      const w = await mountGame();
      vi.advanceTimersByTime(2000);
      await solve();
      await buttonWithText(w, "Reset").trigger("click");

      dialogButton("Cancel").onClick!();
      vi.advanceTimersByTime(3000);
      const store = useGameStore();

      expect(store.state).toBe("solved");
      expect(store.isTimerRunning).toBe(false);
      expect(store.elapsedSeconds).toBe(2);
    });

    it("confirming on a solved puzzle restores it and starts playing again", async () => {
      const w = await mountGame();
      await solve();
      await buttonWithText(w, "Reset").trigger("click");

      dialogButton("Reset").onClick!();
      await flushPromises();
      vi.advanceTimersByTime(1000);
      const store = useGameStore();

      expect(store.cells).toEqual(store.originalCells);
      expect(store.state).toBe("playing");
      expect(store.isTimerRunning).toBe(true);
    });

    it("confirming restores the original puzzle and restarts the clock", async () => {
      const w = await mountGame();
      const store = useGameStore();
      store.cells[40].value = 3;
      await buttonWithText(w, "Reset").trigger("click");

      dialogButton("Reset").onClick!();
      vi.advanceTimersByTime(1000);

      expect(store.cells).toEqual(store.originalCells);
      expect(store.isTimerRunning).toBe(true);
      expect(store.elapsedSeconds).toBe(1);
    });
  });

  describe("solving the puzzle", () => {
    it("stops the clock, marks the game solved and shows the completion dialog", async () => {
      const w = await mountGame();
      vi.advanceTimersByTime(5000);
      const store = useGameStore();

      store.cells = cellsFrom(SOLVED);
      await flushPromises();
      vi.advanceTimersByTime(3000);

      expect(store.state).toBe("solved");
      expect(store.isTimerRunning).toBe(false);
      expect(store.elapsedSeconds).toBe(5);
      expect(w.find('[data-test="complete-dialog"]').exists()).toBe(true);
      expect(w.find('[data-test="complete-dialog"]').text()).toContain("0:05");
      expect(pauseMenuOpen(w)).toBe(false);
    });

    it("saves the solved game locally and to the server", async () => {
      signIn();
      await mountGame();

      useGameStore().cells = cellsFrom(SOLVED);
      await flushPromises();

      expect(storedGame().state).toBe("solved");
      expect(saveProgress).toHaveBeenCalledWith(
        expect.objectContaining({ puzzleId: "new-1", isSolved: true }),
      );
    });

    it("'New Puzzle' starts a fresh puzzle and closes the dialog", async () => {
      const w = await mountGame("medium");
      useGameStore().cells = cellsFrom(SOLVED);
      await flushPromises();
      getNewPuzzle.mockResolvedValue(newPuzzle("medium", "new-2"));

      await buttonWithText(w, "New Puzzle").trigger("click");
      await flushPromises();
      vi.advanceTimersByTime(1000);
      const store = useGameStore();

      expect(getNewPuzzle).toHaveBeenLastCalledWith("medium");
      expect(store.puzzleId).toBe("new-2");
      expect(store.state).toBe("playing");
      expect(store.elapsedSeconds).toBe(1);
      expect(w.find('[data-test="complete-dialog"]').exists()).toBe(false);
    });

    it("shows an error when 'New Puzzle' fails", async () => {
      const w = await mountGame();
      await solve();
      getNewPuzzle.mockResolvedValue({ success: false, status: 503, error: "Server down" });

      await buttonWithText(w, "New Puzzle").trigger("click");
      await flushPromises();

      expect(completeDialogOpen(w)).toBe(false);
      expect(fetchErrorShown()).toBe(true);
      expect(useDialog().dialogState.value?.message).toBe("Server down");
      // The solved game is the same difficulty, so there's nothing to go back to.
      expect(useDialog().dialogState.value?.buttons.map((b) => b.text)).toEqual(["Retry", "Cancel"]);
    });

    it("Cancel after a failed 'New Puzzle' goes home", async () => {
      const w = await mountGame();
      await solve();
      getNewPuzzle.mockResolvedValue({ success: false, status: 503 });
      await buttonWithText(w, "New Puzzle").trigger("click");
      await flushPromises();

      await clickDialogButton("Cancel");

      expect(router.push).toHaveBeenCalledExactlyOnceWith({ name: "home" });
      expect(completeDialogOpen(w)).toBe(false);
    });

    it("keeps the solved board solved when 'New Puzzle' fails", async () => {
      const w = await mountGame();
      await solve();
      getNewPuzzle.mockResolvedValue({ success: false, status: 503, error: "Server down" });

      await buttonWithText(w, "New Puzzle").trigger("click");
      await flushPromises();
      const store = useGameStore();

      expect(store.state).toBe("solved");
      expect(store.isTimerRunning).toBe(false);
      expect(store.puzzleId).toBe("new-1");
    });

    it("'Close' closes the dialog and keeps the solved board", async () => {
      const w = await mountGame();
      useGameStore().cells = cellsFrom(SOLVED);
      await flushPromises();

      await buttonWithText(w, "Close").trigger("click");

      expect(w.find('[data-test="complete-dialog"]').exists()).toBe(false);
      expect(useGameStore().state).toBe("solved");
    });
  });

  describe("saving to the server", () => {
    function makeMove() {
      useGameStore().history.push({ isParent: true, cell: { idx: 1, value: 0, candidates: [] } });
    }

    it("saves 5 seconds after the player stops making moves", async () => {
      signIn();
      await mountGame();

      makeMove();
      await flushPromises();
      vi.advanceTimersByTime(4999);
      expect(saveProgress).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(saveProgress).toHaveBeenCalledOnce();
    });

    it("saves at least every 10 seconds while the player keeps making moves", async () => {
      signIn();
      await mountGame();

      for (let i = 0; i < 5; i++) {
        makeMove();
        await flushPromises();
        vi.advanceTimersByTime(2000);
      }

      expect(saveProgress).toHaveBeenCalledOnce();
    });

    it("does not save to the server when signed out", async () => {
      await mountGame();

      makeMove();
      await flushPromises();
      vi.advanceTimersByTime(10_000);

      expect(saveProgress).not.toHaveBeenCalled();
    });
  });

  describe("leaving", () => {
    it("still sends a pending move save after unmount", async () => {
      signIn();
      const w = await mountGame();
      useGameStore().history.push({ isParent: true, cell: { idx: 1, value: 0, candidates: [] } });
      await flushPromises();

      w.unmount();
      wrapper = undefined;
      vi.advanceTimersByTime(5000);

      expect(saveProgress).toHaveBeenCalledOnce();
    });

    it("stops the clock without pausing the game and saves locally on unmount", async () => {
      const w = await mountGame();
      vi.advanceTimersByTime(4000);

      w.unmount();
      wrapper = undefined;
      vi.advanceTimersByTime(3000);
      const store = useGameStore();

      expect(store.isTimerRunning).toBe(false);
      expect(store.state).toBe("playing");
      expect(storedGame().elapsedSeconds).toBe(4);
    });

    it("saves locally and to the server when a signed-in player leaves the route", async () => {
      signIn();
      await mountGame();

      await guards.leave!();
      await flushPromises(); // the server save finishes in the background

      expect(storedGame().puzzleId).toBe("new-1");
      expect(saveProgress).toHaveBeenCalledOnce();
      expect(toast.success).toHaveBeenCalledOnce();
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("lets the player leave without waiting for the server save", async () => {
      signIn();
      await mountGame();
      saveProgress.mockReturnValue(new Promise(() => {})); // never answers

      let left = false;
      void Promise.resolve(guards.leave!()).then(() => (left = true));
      await flushPromises();

      expect(left).toBe(true);
    });

    it("tells the player when the save on leaving fails", async () => {
      signIn();
      await mountGame();
      saveProgress.mockResolvedValue({ success: false, status: 503, error: "Server down" });

      await guards.leave!();
      await flushPromises();

      expect(toast.error).toHaveBeenCalledOnce();
      expect(vi.mocked(toast.error).mock.calls[0]![0]).toContain("Server down");
      expect(toast.success).not.toHaveBeenCalled();
    });

    it("only saves locally when a signed-out player leaves the route", async () => {
      await mountGame();
      localStorage.clear();

      await guards.leave!();
      await flushPromises();

      expect(storedGame().puzzleId).toBe("new-1");
      expect(saveProgress).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
    });
  });

  describe("changing difficulty in the URL", () => {
    it("blocks an unsupported difficulty and explains why", async () => {
      await mountGame();

      const result = guards.update!({ params: { difficulty: "impossible" } });

      expect(result).toBe(false);
      expect(toast.error).toHaveBeenCalledWith(
        "'impossible' is not an accepted difficulty. Currently only " +
          "'beginner', 'easy', 'medium', and 'hard' are playable.",
      );
    });

    it.each(["beginner", "easy", "medium", "hard"])("allows %s", async (difficulty) => {
      await mountGame();

      expect(guards.update!({ params: { difficulty } })).toBeUndefined();
      expect(toast.error).not.toHaveBeenCalled();
    });
  });
});
