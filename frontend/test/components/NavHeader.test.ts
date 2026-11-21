import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia, type Pinia } from "pinia";
import { toast } from "vue-sonner";
import NavHeader from "@/components/NavHeader.vue";
import { useGameStore, type Cell, type DifficultyRating } from "@/stores/gameStore";
import { useUserStore } from "@/stores/userStore";
import { useDialog } from "@/composables/useDialog";
import { useGameSession } from "@/composables/useGameSession";
import type { GameSnapshot } from "@/validation/localStorage";
import * as sudokuService from "@/services/sudokuService";
import * as userService from "@/services/userService";
import { createBlankCells } from "@/utils/puzzleUtils";

// Only the network, router, toast and login-form boundaries are mocked. The
// stores, dialog, useAuth, useGameSession, usePuzzleNavigation and the reka-ui
// menus run for real so these tests check what the player sees and clicks.
// usePuzzleNavigation has its own suite; here we check the header wires it up.
vi.mock("@/services/sudokuService", () => ({
  getNewPuzzle: vi.fn(),
  getSavedProgress: vi.fn(),
  saveProgress: vi.fn(),
}));
vi.mock("@/services/userService", () => ({
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  getSession: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  requestEmailVerification: vi.fn(),
}));

const router = vi.hoisted(() => ({ push: vi.fn() }));
// The page the player is on; tests point it at a puzzle page when it matters.
const route = vi.hoisted(() => ({ name: "home", params: {} as Record<string, unknown> }));
vi.mock("vue-router", () => ({
  useRouter: () => router,
  useRoute: () => route,
}));

function onPuzzlePage(difficulty: DifficultyRating) {
  route.name = "sudoku";
  route.params = { difficulty };
}

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

// The login popover/drawer have their own forms and suites; here we only care
// whether the header offers them.
vi.mock("@/components/loginRegister/LoginPopover.vue", async () => {
  const { defineComponent, h } = await import("vue");
  return {
    default: defineComponent({
      name: "LoginPopover",
      setup: () => () => h("button", { "data-testid": "login-popover" }, "Login"),
    }),
  };
});
vi.mock("@/components/loginRegister/LoginDrawer.vue", async () => {
  const { defineComponent, h } = await import("vue");
  return {
    default: defineComponent({
      name: "LoginDrawer",
      setup: () => () => h("button", { "data-testid": "login-drawer" }, "Login"),
    }),
  };
});

const getNewPuzzle = vi.mocked(sudokuService.getNewPuzzle);
const getSavedProgress = vi.mocked(sudokuService.getSavedProgress);
const logout = vi.mocked(userService.logout);

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
const COLOR_KEY = "vueuse-color-scheme";
const DIFFICULTIES = [
  ["Beginner", "beginner"],
  ["Easy", "easy"],
  ["Medium", "medium"],
  ["Hard", "hard"],
] as const;

function puzzleCells(): Cell[] {
  const cells = createBlankCells();
  cells[0].value = 5;
  cells[80].value = 9;
  return cells;
}

function cellsFrom(digits: string): Cell[] {
  return digits.split("").map((d, idx) => ({ idx, value: Number(d), candidates: [] }));
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

// A game in progress, both in the store and saved locally, the way it is after
// a page has loaded it. The header itself never loads the saved game.
function gameInProgress(overrides: Partial<GameSnapshot> = {}) {
  const session = useGameSession();
  session.applySnapshot(localGame(overrides));
  session.saveLocal();
}

function newPuzzle(difficulty: DifficultyRating, puzzleId = "new-1") {
  return {
    success: true as const,
    status: 200,
    body: { puzzleId, cells: puzzleCells(), difficultyRating: difficulty, difficultyScore: 100 },
  };
}

function serverPuzzle(difficulty: DifficultyRating, puzzleId = "server-1") {
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

function signIn(currentPuzzleId?: string) {
  useUserStore().set({ id: "user-1", email: "a@b.c", role: "user", currentPuzzleId });
}

// Clicks a button in the app-wide dialog the way AppDialog does: wait for
// onClick, then close if closeOnClick is set.
async function clickDialogButton(text: string) {
  const btn = useDialog().dialogState.value!.buttons.find((b) => b.text === text)!;
  await btn.onClick?.();
  if (btn.closeOnClick) useDialog().closeDialog();
  await flushPromises();
}

function sudokuRoute(difficulty: DifficultyRating) {
  return { name: "sudoku", params: { difficulty } };
}

let pinia: Pinia;
let wrapper: VueWrapper | undefined;

// Menus and the mobile popover teleport/render outside the wrapper, so the
// header is attached to the document and queried through it.
async function mountHeader() {
  wrapper = mount(NavHeader, { global: { plugins: [pinia] }, attachTo: document.body });
  await flushPromises();
  return wrapper;
}

function buttonIn(root: ParentNode | null | undefined, text: string) {
  if (!root) return undefined;
  return [...root.querySelectorAll("button")].find((b) => b.textContent?.trim() === text);
}

async function click(el: HTMLElement | undefined) {
  expect(el, "element to click").toBeDefined();
  el!.click();
  await flushPromises();
}

// The labels of the buttons in a menu, in order.
function menuItems(root: ParentNode | null | undefined) {
  return [...(root?.querySelectorAll("button") ?? [])].map((b) => b.textContent?.trim());
}

// ---- desktop (md and wider) menu ----
function desktopNav() {
  return document.querySelector("nav");
}
function desktopColorToggle() {
  return document.querySelector<HTMLButtonElement>("header button[aria-pressed]");
}
function desktopPuzzleList() {
  return desktopNav()?.querySelector<HTMLElement>('[data-slot="navigation-menu-content"]');
}
async function openDesktopPuzzleMenu() {
  await click(buttonIn(desktopNav(), "Puzzles"));
  expect(desktopPuzzleList()).not.toBeNull();
}

// ---- mobile menu ----
function mobileTrigger() {
  return document.querySelector<HTMLButtonElement>('header button[aria-haspopup="dialog"]')!;
}
function mobileMenu() {
  return document.querySelector<HTMLElement>('[data-slot="popover-content"]');
}
async function openMobileMenu() {
  await click(mobileTrigger());
  expect(mobileMenu()).not.toBeNull();
}
function mobilePuzzleList() {
  return mobileMenu()?.querySelector<HTMLElement>('[data-slot="accordion-content"]');
}
async function openMobilePuzzleMenu() {
  await openMobileMenu();
  await click(buttonIn(mobileMenu(), "Puzzles"));
}
function darkModeSwitch() {
  return mobileMenu()?.querySelector<HTMLButtonElement>('[role="switch"]');
}
function iconOf(el: Element | null | undefined) {
  return el?.querySelector("[data-icon]")?.getAttribute("data-icon");
}

describe("NavHeader.vue", () => {
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    localStorage.clear();
    document.documentElement.className = "";
    vi.clearAllMocks();
    route.name = "home";
    route.params = {};
    // Dialog state lives at module level, so clear anything a previous test opened.
    useDialog().closeDialog();
  });
  afterEach(() => {
    useGameStore().haltClock();
    wrapper?.unmount();
    wrapper = undefined;
    document.body.innerHTML = "";
  });

  describe("rendering", () => {
    it("shows the title, Home, About and Puzzles links", async () => {
      await mountHeader();
      const nav = desktopNav();

      expect(document.querySelector("h1")?.textContent).toContain("Infinite Sudoku");
      expect(buttonIn(nav, "Home")).toBeDefined();
      expect(buttonIn(nav, "About")).toBeDefined();
      expect(buttonIn(nav, "Puzzles")).toBeDefined();
    });

    it("keeps the difficulty list and the mobile menu closed until opened", async () => {
      await mountHeader();

      expect(buttonIn(desktopNav(), "Beginner")).toBeUndefined();
      expect(mobileMenu()).toBeNull();
      expect(mobileTrigger().getAttribute("aria-expanded")).toBe("false");
    });

    it("offers Login rather than Logout to a signed-out visitor", async () => {
      await mountHeader();

      expect(document.querySelector('[data-testid="login-popover"]')).not.toBeNull();
      expect(buttonIn(desktopNav(), "Logout")).toBeUndefined();
    });

    it("offers Logout rather than Login to a signed-in user", async () => {
      signIn();
      await mountHeader();

      expect(document.querySelector('[data-testid="login-popover"]')).toBeNull();
      expect(buttonIn(desktopNav(), "Logout")).toBeDefined();
    });

    it("swaps Login for Logout as soon as the user signs in", async () => {
      await mountHeader();

      signIn();
      await flushPromises();

      expect(document.querySelector('[data-testid="login-popover"]')).toBeNull();
      expect(buttonIn(desktopNav(), "Logout")).toBeDefined();
    });
  });

  describe("navigation links", () => {
    it("the title goes home", async () => {
      await mountHeader();

      await click(document.querySelector<HTMLElement>("h1 a")!);

      expect(router.push).toHaveBeenCalledExactlyOnceWith({ name: "home" });
    });

    it.each([
      ["Home", "home"],
      ["About", "about"],
    ])("desktop %s goes to the %s page", async (label, name) => {
      await mountHeader();

      await click(buttonIn(desktopNav(), label));

      expect(router.push).toHaveBeenCalledExactlyOnceWith({ name });
    });

    it.each([
      ["Home", "home"],
      ["About", "about"],
    ])("mobile %s goes to the %s page and closes the menu", async (label, name) => {
      await mountHeader();
      await openMobileMenu();

      await click(buttonIn(mobileMenu(), label));

      expect(router.push).toHaveBeenCalledExactlyOnceWith({ name });
      expect(mobileMenu()).toBeNull();
    });
  });

  describe("desktop Puzzles menu", () => {
    it("lists every difficulty, with no Resume when nothing is in progress", async () => {
      await mountHeader();

      await openDesktopPuzzleMenu();

      expect(menuItems(desktopPuzzleList())).toEqual(["Beginner", "Easy", "Medium", "Hard"]);
    });

    it("puts Resume first when a local game is in progress", async () => {
      gameInProgress();
      await mountHeader();

      await openDesktopPuzzleMenu();

      expect(menuItems(desktopPuzzleList())).toEqual(["Resume", "Beginner", "Easy", "Medium", "Hard"]);
    });

    it("offers Resume to a signed-in user with a puzzle saved on the server", async () => {
      signIn("server-1");
      await mountHeader();

      await openDesktopPuzzleMenu();

      expect(buttonIn(desktopPuzzleList(), "Resume")).toBeDefined();
    });

    it("hides Resume when the local game is already solved", async () => {
      gameInProgress({ cells: cellsFrom(SOLVED) });
      await mountHeader();

      await openDesktopPuzzleMenu();

      expect(buttonIn(desktopPuzzleList(), "Resume")).toBeUndefined();
    });

    it("hides Resume for a server puzzle id when the user isn't signed in", async () => {
      useUserStore().currentPuzzleId = "server-1";
      await mountHeader();

      await openDesktopPuzzleMenu();

      expect(buttonIn(desktopPuzzleList(), "Resume")).toBeUndefined();
    });

    it("shows Resume as soon as a game starts while the header is up", async () => {
      await mountHeader();

      gameInProgress();
      await openDesktopPuzzleMenu();

      expect(buttonIn(desktopPuzzleList(), "Resume")).toBeDefined();
    });

    it.each(DIFFICULTIES)(
      "%s goes straight to a %s puzzle when nothing is in progress",
      async (label, difficulty) => {
        await mountHeader();
        await openDesktopPuzzleMenu();

        await click(buttonIn(desktopPuzzleList(), label));

        // The puzzle page loads its own puzzle when it mounts.
        expect(getNewPuzzle).not.toHaveBeenCalled();
        expect(useDialog().isOpen.value).toBe(false);
        expect(router.push).toHaveBeenCalledExactlyOnceWith(sudokuRoute(difficulty));
      },
    );

    it("closes the list after a choice", async () => {
      await mountHeader();
      await openDesktopPuzzleMenu();

      await click(buttonIn(desktopPuzzleList(), "Easy"));

      expect(desktopPuzzleList()).toBeNull();
    });

    it("asks before overwriting a game in progress, and doesn't navigate", async () => {
      gameInProgress();
      await mountHeader();
      await openDesktopPuzzleMenu();

      await click(buttonIn(desktopPuzzleList(), "Hard"));

      expect(useDialog().dialogState.value?.title).toBe("Overwrite current game?");
      expect(router.push).not.toHaveBeenCalled();
      expect(localStorage.getItem(SESSION_KEY)).not.toBeNull();
    });

    it("New Game in the overwrite dialog starts the chosen difficulty", async () => {
      gameInProgress();
      await mountHeader();
      await openDesktopPuzzleMenu();
      await click(buttonIn(desktopPuzzleList(), "Hard"));

      await clickDialogButton("New Game");

      expect(localStorage.getItem(SESSION_KEY)).toBeNull();
      expect(useGameStore().puzzleId).toBeUndefined();
      expect(router.push).toHaveBeenCalledExactlyOnceWith(sudokuRoute("hard"));
    });

    it("New Game on the page for that difficulty loads a new puzzle without navigating", async () => {
      // Pushing the current URL wouldn't remount the page, so it loads in place.
      onPuzzlePage("easy");
      gameInProgress({ difficultyRating: "easy" });
      getNewPuzzle.mockResolvedValue(newPuzzle("easy"));
      await mountHeader();
      await openDesktopPuzzleMenu();
      await click(buttonIn(desktopPuzzleList(), "Easy"));

      await clickDialogButton("New Game");

      expect(getNewPuzzle).toHaveBeenCalledExactlyOnceWith("easy");
      expect(useGameStore().puzzleId).toBe("new-1");
      expect(router.push).not.toHaveBeenCalled();
    });

    it("New Game on a puzzle page for another difficulty navigates there", async () => {
      onPuzzlePage("easy");
      gameInProgress({ difficultyRating: "easy" });
      await mountHeader();
      await openDesktopPuzzleMenu();
      await click(buttonIn(desktopPuzzleList(), "Hard"));

      await clickDialogButton("New Game");

      expect(getNewPuzzle).not.toHaveBeenCalled();
      expect(router.push).toHaveBeenCalledExactlyOnceWith(sudokuRoute("hard"));
    });

    it("Resume returns to the local game at its own difficulty", async () => {
      gameInProgress({ difficultyRating: "medium" });
      await mountHeader();
      await openDesktopPuzzleMenu();

      await click(buttonIn(desktopPuzzleList(), "Resume"));

      expect(getSavedProgress).not.toHaveBeenCalled();
      expect(router.push).toHaveBeenCalledExactlyOnceWith(sudokuRoute("medium"));
    });

    it("Resume loads a signed-in user's server puzzle and goes to its difficulty", async () => {
      signIn("server-1");
      getSavedProgress.mockResolvedValue(serverPuzzle("hard"));
      await mountHeader();
      await openDesktopPuzzleMenu();

      await click(buttonIn(desktopPuzzleList(), "Resume"));

      expect(getSavedProgress).toHaveBeenCalledExactlyOnceWith("server-1");
      expect(useGameStore().puzzleId).toBe("server-1");
      expect(router.push).toHaveBeenCalledExactlyOnceWith(sudokuRoute("hard"));
    });

    it("Resume shows the error and stays put when the server puzzle can't be loaded", async () => {
      signIn("server-1");
      getSavedProgress.mockResolvedValue({ success: false, status: 404, error: "Puzzle not found" });
      await mountHeader();
      await openDesktopPuzzleMenu();

      await click(buttonIn(desktopPuzzleList(), "Resume"));

      expect(toast.error).toHaveBeenCalledExactlyOnceWith("Puzzle not found");
      expect(router.push).not.toHaveBeenCalled();
    });
  });

  describe("mobile Puzzles menu", () => {
    it("hides the difficulty list until Puzzles is expanded", async () => {
      await mountHeader();
      await openMobileMenu();

      expect(buttonIn(mobileMenu(), "Beginner")).toBeUndefined();

      await click(buttonIn(mobileMenu(), "Puzzles"));

      expect(menuItems(mobilePuzzleList())).toEqual(["Beginner", "Easy", "Medium", "Hard"]);
    });

    it("collapses the difficulty list when Puzzles is pressed again", async () => {
      await mountHeader();
      await openMobilePuzzleMenu();

      await click(buttonIn(mobileMenu(), "Puzzles"));

      expect(buttonIn(mobileMenu(), "Beginner")).toBeUndefined();
    });

    it("puts Resume first when a game is in progress", async () => {
      gameInProgress();
      await mountHeader();

      await openMobilePuzzleMenu();

      expect(menuItems(mobilePuzzleList())).toEqual(["Resume", "Beginner", "Easy", "Medium", "Hard"]);
    });

    it.each(DIFFICULTIES)(
      "%s navigates to a %s puzzle and closes the menu",
      async (label, difficulty) => {
        await mountHeader();
        await openMobilePuzzleMenu();

        await click(buttonIn(mobileMenu(), label));

        expect(router.push).toHaveBeenCalledExactlyOnceWith(sudokuRoute(difficulty));
        expect(mobileMenu()).toBeNull();
      },
    );

    it("Hard is enabled", async () => {
      await mountHeader();
      await openMobilePuzzleMenu();

      expect(buttonIn(mobileMenu(), "Hard")!.disabled).toBe(false);
    });

    it("on the page for that difficulty after solving, loads a new puzzle in place", async () => {
      onPuzzlePage("medium");
      gameInProgress({ difficultyRating: "medium", cells: cellsFrom(SOLVED) });
      getNewPuzzle.mockResolvedValue(newPuzzle("medium"));
      await mountHeader();
      await openMobilePuzzleMenu();

      await click(buttonIn(mobileMenu(), "Medium"));

      expect(useDialog().isOpen.value).toBe(false);
      expect(getNewPuzzle).toHaveBeenCalledExactlyOnceWith("medium");
      expect(useGameStore().puzzleId).toBe("new-1");
      expect(router.push).not.toHaveBeenCalled();
      expect(mobileMenu()).toBeNull();
    });

    it("Resume returns to the game in progress and closes the menu", async () => {
      gameInProgress({ difficultyRating: "beginner" });
      await mountHeader();
      await openMobilePuzzleMenu();

      await click(buttonIn(mobileMenu(), "Resume"));

      expect(router.push).toHaveBeenCalledExactlyOnceWith(sudokuRoute("beginner"));
      expect(mobileMenu()).toBeNull();
    });

    it("asks before overwriting a game in progress, closing the menu for the dialog", async () => {
      gameInProgress();
      await mountHeader();
      await openMobilePuzzleMenu();

      await click(buttonIn(mobileMenu(), "Medium"));

      expect(useDialog().dialogState.value?.title).toBe("Overwrite current game?");
      expect(router.push).not.toHaveBeenCalled();
      expect(mobileMenu()).toBeNull();
    });
  });

  describe("mobile menu button", () => {
    it("shows a plain menu icon before it's ever pressed", async () => {
      await mountHeader();

      expect(iconOf(mobileTrigger())).toBe("line-md:menu");
    });

    it("animates to a close icon when opened", async () => {
      await mountHeader();

      await openMobileMenu();

      expect(mobileTrigger().getAttribute("aria-expanded")).toBe("true");
      expect(iconOf(mobileTrigger())).toBe("line-md:menu-to-close-alt-transition");
    });

    it("animates back to a menu icon when closed again", async () => {
      await mountHeader();
      await openMobileMenu();

      await click(mobileTrigger());

      expect(mobileMenu()).toBeNull();
      expect(iconOf(mobileTrigger())).toBe("line-md:close-to-menu-alt-transition");
    });

    it("animates back to a menu icon when closed by picking a link", async () => {
      await mountHeader();
      await openMobileMenu();

      await click(buttonIn(mobileMenu(), "About"));

      expect(iconOf(mobileTrigger())).toBe("line-md:close-to-menu-alt-transition");
    });

    it("closes when Escape is pressed", async () => {
      await mountHeader();
      await openMobileMenu();

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await flushPromises();

      expect(mobileMenu()).toBeNull();
      expect(router.push).not.toHaveBeenCalled();
    });

    it("offers the login drawer to a signed-out visitor", async () => {
      await mountHeader();
      await openMobileMenu();

      expect(mobileMenu()!.querySelector('[data-testid="login-drawer"]')).not.toBeNull();
      expect(buttonIn(mobileMenu(), "Logout")).toBeUndefined();
    });

    it("offers Logout to a signed-in user", async () => {
      signIn();
      await mountHeader();
      await openMobileMenu();

      expect(mobileMenu()!.querySelector('[data-testid="login-drawer"]')).toBeNull();
      expect(buttonIn(mobileMenu(), "Logout")).toBeDefined();
    });
  });

  describe("logging out", () => {
    beforeEach(() => signIn());

    it("signs the user out and offers Login again", async () => {
      logout.mockResolvedValue({ success: true, status: 200 });
      await mountHeader();

      await click(buttonIn(desktopNav(), "Logout"));

      expect(logout).toHaveBeenCalledOnce();
      expect(useUserStore().isAuthenticated).toBe(false);
      expect(useUserStore().loading).toBe(false);
      expect(document.querySelector('[data-testid="login-popover"]')).not.toBeNull();
      expect(buttonIn(desktopNav(), "Logout")).toBeUndefined();
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("signs the user out from the mobile menu", async () => {
      logout.mockResolvedValue({ success: true, status: 200 });
      await mountHeader();
      await openMobileMenu();

      await click(buttonIn(mobileMenu(), "Logout"));

      expect(logout).toHaveBeenCalledOnce();
      expect(useUserStore().isAuthenticated).toBe(false);
      expect(mobileMenu()?.querySelector('[data-testid="login-drawer"]')).not.toBeNull();
    });

    it("still signs the user out locally when the server call fails", async () => {
      logout.mockResolvedValue({ success: false, status: 500, error: "server down" });
      await mountHeader();

      await click(buttonIn(desktopNav(), "Logout"));

      expect(toast.error).toHaveBeenCalledOnce();
      expect(useUserStore().isAuthenticated).toBe(false);
      expect(document.querySelector('[data-testid="login-popover"]')).not.toBeNull();
    });

    it("keeps the user signed in when the logout request throws", async () => {
      logout.mockRejectedValue(new Error("network down"));
      await mountHeader();

      await click(buttonIn(desktopNav(), "Logout"));

      expect(toast.error).toHaveBeenCalledOnce();
      expect(useUserStore().isAuthenticated).toBe(true);
      expect(useUserStore().loading).toBe(false);
      expect(buttonIn(desktopNav(), "Logout")).toBeDefined();
    });

    it("leaves the current game alone", async () => {
      logout.mockResolvedValue({ success: true, status: 200 });
      useGameStore().puzzleId = "game-1";
      await mountHeader();

      await click(buttonIn(desktopNav(), "Logout"));

      expect(useGameStore().puzzleId).toBe("game-1");
      expect(router.push).not.toHaveBeenCalled();
    });
  });

  describe("dark mode", () => {
    it("starts in light mode with an unpressed sun toggle", async () => {
      await mountHeader();
      const toggle = desktopColorToggle()!;

      expect(toggle.getAttribute("aria-pressed")).toBe("false");
      expect(iconOf(toggle)).toBe("line-md:sunny");
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });

    it("the desktop toggle switches to dark mode and back", async () => {
      await mountHeader();

      await click(desktopColorToggle()!);

      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(desktopColorToggle()!.getAttribute("aria-pressed")).toBe("true");
      expect(iconOf(desktopColorToggle())).toBe("line-md:moon-simple");
      expect(localStorage.getItem(COLOR_KEY)).toBe("dark");

      await click(desktopColorToggle()!);

      expect(document.documentElement.classList.contains("dark")).toBe(false);
      expect(iconOf(desktopColorToggle())).toBe("line-md:sunny");
      expect(localStorage.getItem(COLOR_KEY)).toBe("light");
    });

    it("the mobile switch switches to dark mode and back", async () => {
      await mountHeader();
      await openMobileMenu();

      expect(darkModeSwitch()!.getAttribute("aria-checked")).toBe("false");

      await click(darkModeSwitch()!);

      expect(darkModeSwitch()!.getAttribute("aria-checked")).toBe("true");
      expect(document.documentElement.classList.contains("dark")).toBe(true);

      await click(darkModeSwitch()!);

      expect(darkModeSwitch()!.getAttribute("aria-checked")).toBe("false");
      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });

    it("keeps the desktop toggle and mobile switch in sync", async () => {
      await mountHeader();
      await click(desktopColorToggle()!);

      await openMobileMenu();
      expect(darkModeSwitch()!.getAttribute("aria-checked")).toBe("true");

      await click(darkModeSwitch()!);
      expect(desktopColorToggle()!.getAttribute("aria-pressed")).toBe("false");
      expect(iconOf(desktopColorToggle())).toBe("line-md:sunny");
    });

    it("restores a saved dark mode preference", async () => {
      localStorage.setItem(COLOR_KEY, "dark");

      await mountHeader();

      expect(document.documentElement.classList.contains("dark")).toBe(true);
      expect(desktopColorToggle()!.getAttribute("aria-pressed")).toBe("true");
      expect(iconOf(desktopColorToggle())).toBe("line-md:moon-simple");
    });
  });
});
