import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { toast } from "vue-sonner";
import { useAuth } from "@/composables/useAuth";
import { useDialog } from "@/composables/useDialog";
import { useGameStore } from "@/stores/gameStore";
import { useUserStore } from "@/stores/userStore";
import * as userService from "@/services/userService";
import type { UserDto } from "@/services/userService";

vi.mock("@/services/userService", () => ({
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  getSession: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  requestEmailVerification: vi.fn(),
}));

// useGameSession is tested on its own; here we only care which of its
// functions useAuth decides to call.
const session = {
  saveToServer: vi.fn(),
  resumeSavedPuzzle: vi.fn(),
};
vi.mock("@/composables/useGameSession", () => ({
  useGameSession: () => session,
}));

// The clock is tested on its own (gameStore / useGameClock); here we only
// care when useAuth starts and pauses it.
const clock = { start: vi.fn(), pause: vi.fn(), halt: vi.fn(), reset: vi.fn() };
vi.mock("@/composables/useGameClock", () => ({
  useGameClock: () => clock,
}));

const router = { push: vi.fn() };
// The page the player is on when they log in.
const route = { params: {} as Record<string, unknown> };
vi.mock("vue-router", () => ({
  useRouter: () => router,
  useRoute: () => route,
}));

vi.mock("vue-sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const svc = vi.mocked(userService);
const toastError = vi.mocked(toast.error);
const toastSuccess = vi.mocked(toast.success);

// What the player reads in a toast: its title plus any description.
function toastText(call: unknown[]): string {
  const [message, options] = call as [string, { description?: string } | undefined];
  return [message, options?.description].filter(Boolean).join(" ");
}

// Checks that one error toast is shown, and that it carries the given detail
// (e.g. the server's error) without pinning the surrounding wording.
function expectErrorToast(containing?: string) {
  expect(toastError).toHaveBeenCalledOnce();
  const text = toastText(toastError.mock.calls[0]!);
  expect(text.trim()).not.toBe("");
  // A missing message must not leak through as "undefined" or a JS error.
  expect(text).not.toMatch(/undefined|Cannot read/);
  if (containing) expect(text).toContain(containing);
}

function makeUser(overrides: Partial<UserDto> = {}): UserDto {
  return {
    id: "user-1",
    username: "player",
    email: "player@example.com",
    role: "user",
    ...overrides,
  };
}

// A successful resume of a puzzle with the given difficulty.
function resumedPuzzle(difficultyRating: string) {
  return { success: true, status: 200, body: { puzzleId: "saved-1", difficultyRating } };
}

describe("useAuth", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    session.saveToServer.mockResolvedValue({ success: true, status: 200 });
    session.resumeSavedPuzzle.mockResolvedValue({ success: true, status: 200 });
    route.params = {};
    // Dialog state lives at module level, so clear anything a previous test opened.
    useDialog().closeDialog();
  });

  describe("login", () => {
    it("sets the user and returns true on success", async () => {
      svc.login.mockResolvedValue({
        success: true,
        status: 200,
        body: { user: makeUser() },
      });
      const userStore = useUserStore();

      const result = await useAuth().login("player@example.com", "Secret1!");

      expect(svc.login).toHaveBeenCalledWith("player@example.com", "Secret1!");
      expect(result).toBe(true);
      expect(userStore.isAuthenticated).toBe(true);
      expect(userStore.username).toBe("player");
      expect(userStore.loading).toBe(false);
    });

    it("shows the server error and returns false when login fails", async () => {
      svc.login.mockResolvedValue({
        success: false,
        status: 401,
        error: "Wrong password",
      });
      const userStore = useUserStore();

      const result = await useAuth().login("a@b.com", "x");

      expect(result).toBe(false);
      expectErrorToast("Wrong password");
      expect(userStore.isAuthenticated).toBe(false);
      expect(userStore.loading).toBe(false);
    });

    it("falls back to a generic message when the failure has no error", async () => {
      svc.login.mockResolvedValue({ success: false, status: 500 });

      await useAuth().login("a@b.com", "x");

      expectErrorToast();
    });

    it("offers to resend verification when the email is not verified", async () => {
      svc.login.mockResolvedValue({
        success: false,
        status: 403,
        error: "Email not verified",
      });

      const result = await useAuth().login("a@b.com", "x");

      expect(result).toBe(false);
      expectErrorToast();
      const [message, options] = toastError.mock.calls[0]!;
      expect(message).toMatch(/not verified/i);
      (options as { action: { onClick: () => void } }).action.onClick();
      expect(router.push).toHaveBeenCalledWith({
        name: "request-email-verification",
      });
    });

    it("returns false when the response has no user", async () => {
      svc.login.mockResolvedValue({ success: true, status: 200, body: undefined });
      const userStore = useUserStore();

      const result = await useAuth().login("a@b.com", "x");

      expect(result).toBe(false);
      expectErrorToast();
      expect(userStore.isAuthenticated).toBe(false);
      expect(userStore.loading).toBe(false);
    });

    it("shows an error toast and resets loading when the service throws", async () => {
      svc.login.mockRejectedValue(new Error("network down"));
      const userStore = useUserStore();

      const result = await useAuth().login("a@b.com", "x");

      expect(result).toBe(false);
      expectErrorToast("network down");
      expect(userStore.loading).toBe(false);
    });

    describe("with no puzzle in progress locally", () => {
      it("resumes the user's saved puzzle", async () => {
        svc.login.mockResolvedValue({
          success: true,
          status: 200,
          body: { user: makeUser({ currentPuzzleId: "saved-1" }) },
        });

        await useAuth().login("a@b.com", "x");

        expect(session.resumeSavedPuzzle).toHaveBeenCalledWith("saved-1");
        expect(session.saveToServer).not.toHaveBeenCalled();
      });

      it.each([
        ["with the server's message", { success: false as const, status: 404, error: "Puzzle gone" }, "Puzzle gone"],
        ["without a message", { success: false as const, status: 500 }, undefined],
      ])("still logs in, and shows an error, when resuming fails %s", async (_, failure, detail) => {
        svc.login.mockResolvedValue({
          success: true,
          status: 200,
          body: { user: makeUser({ currentPuzzleId: "saved-1" }) },
        });
        session.resumeSavedPuzzle.mockResolvedValue(failure);

        const result = await useAuth().login("a@b.com", "x");

        expect(result).toBe(true);
        expect(useUserStore().isAuthenticated).toBe(true);
        expectErrorToast(detail);
        expect(router.push).not.toHaveBeenCalled();
      });

      it("still logs in, and shows an error, when resuming throws", async () => {
        svc.login.mockResolvedValue({
          success: true,
          status: 200,
          body: { user: makeUser({ currentPuzzleId: "saved-1" }) },
        });
        session.resumeSavedPuzzle.mockRejectedValue(new Error("Puzzle gone"));
        const userStore = useUserStore();

        const result = await useAuth().login("a@b.com", "x");

        expect(result).toBe(true);
        expect(userStore.isAuthenticated).toBe(true);
        expect(userStore.loading).toBe(false);
        expectErrorToast("Puzzle gone");
        expect(router.push).not.toHaveBeenCalled();
      });

      it("opens the resumed puzzle's page when it is a different difficulty", async () => {
        route.params = { difficulty: "easy" };
        svc.login.mockResolvedValue({
          success: true,
          status: 200,
          body: { user: makeUser({ currentPuzzleId: "saved-1" }) },
        });
        session.resumeSavedPuzzle.mockResolvedValue(resumedPuzzle("hard"));

        await useAuth().login("a@b.com", "x");

        expect(router.push).toHaveBeenCalledExactlyOnceWith({
          name: "sudoku",
          params: { difficulty: "hard" },
        });
      });

      it("opens the resumed puzzle's page when logging in away from a puzzle", async () => {
        // e.g. on the home page, which has no difficulty param
        svc.login.mockResolvedValue({
          success: true,
          status: 200,
          body: { user: makeUser({ currentPuzzleId: "saved-1" }) },
        });
        session.resumeSavedPuzzle.mockResolvedValue(resumedPuzzle("medium"));

        await useAuth().login("a@b.com", "x");

        expect(router.push).toHaveBeenCalledExactlyOnceWith({
          name: "sudoku",
          params: { difficulty: "medium" },
        });
      });

      it("stays on the page when the resumed puzzle is that page's difficulty", async () => {
        route.params = { difficulty: "hard" };
        svc.login.mockResolvedValue({
          success: true,
          status: 200,
          body: { user: makeUser({ currentPuzzleId: "saved-1" }) },
        });
        session.resumeSavedPuzzle.mockResolvedValue(resumedPuzzle("hard"));

        await useAuth().login("a@b.com", "x");

        expect(router.push).not.toHaveBeenCalled();
      });

      it("does nothing with puzzles when the user has none saved", async () => {
        svc.login.mockResolvedValue({
          success: true,
          status: 200,
          body: { user: makeUser() },
        });

        await useAuth().login("a@b.com", "x");

        expect(session.resumeSavedPuzzle).not.toHaveBeenCalled();
        expect(session.saveToServer).not.toHaveBeenCalled();
      });
    });

    describe("with a puzzle in progress locally", () => {
      beforeEach(() => {
        useGameStore().puzzleId = "local-1";
      });

      it("saves the local puzzle when the user has none saved", async () => {
        svc.login.mockResolvedValue({
          success: true,
          status: 200,
          body: { user: makeUser() },
        });

        await useAuth().login("a@b.com", "x");

        expect(session.saveToServer).toHaveBeenCalledTimes(1);
        expect(session.resumeSavedPuzzle).not.toHaveBeenCalled();
        expect(useDialog().isOpen.value).toBe(false);
      });

      it("saves the local puzzle when it is the same one the user has saved", async () => {
        svc.login.mockResolvedValue({
          success: true,
          status: 200,
          body: { user: makeUser({ currentPuzzleId: "local-1" }) },
        });

        await useAuth().login("a@b.com", "x");

        expect(session.saveToServer).toHaveBeenCalledTimes(1);
        expect(useDialog().isOpen.value).toBe(false);
      });

      it.each([
        ["with the server's message", { success: false as const, status: 503, error: "Server down" }, "Server down"],
        ["without a message", { success: false as const, status: 500 }, undefined],
      ])("still logs in, and shows an error, when saving fails %s", async (_, failure, detail) => {
        svc.login.mockResolvedValue({
          success: true,
          status: 200,
          body: { user: makeUser() },
        });
        session.saveToServer.mockResolvedValue(failure);

        const result = await useAuth().login("a@b.com", "x");

        expect(result).toBe(true);
        expect(useUserStore().isAuthenticated).toBe(true);
        expectErrorToast(detail);
      });

      describe("when the user has a different puzzle saved", () => {
        beforeEach(() => {
          svc.login.mockResolvedValue({
            success: true,
            status: 200,
            body: { user: makeUser({ currentPuzzleId: "saved-1" }) },
          });
        });

        it("asks whether to overwrite or resume instead of choosing", async () => {
          await useAuth().login("a@b.com", "x");

          const { isOpen, dialogState } = useDialog();
          expect(isOpen.value).toBe(true);
          expect(dialogState.value?.title).toBe("Resume or Overwrite?");
          expect(session.saveToServer).not.toHaveBeenCalled();
          expect(session.resumeSavedPuzzle).not.toHaveBeenCalled();
        });

        it("finishes logging in without waiting for the user to choose", async () => {
          const userStore = useUserStore();

          const result = await useAuth().login("a@b.com", "x");

          expect(result).toBe(true);
          expect(userStore.isAuthenticated).toBe(true);
          expect(userStore.loading).toBe(false);
        });

        it("stops the clock without pausing the game while the dialog is open", async () => {
          await useAuth().login("a@b.com", "x");

          // halt, not pause: pausing would open the pause menu over this dialog.
          expect(clock.halt).toHaveBeenCalledOnce();
          expect(clock.pause).not.toHaveBeenCalled();
          expect(useDialog().isOpen.value).toBe(true);
          expect(clock.start).not.toHaveBeenCalled();
        });

        it("saves the local puzzle and restarts the clock when the user chooses to overwrite", async () => {
          await useAuth().login("a@b.com", "x");

          const button = useDialog().dialogState.value!.buttons.find(
            (b) => b.text === "Overwrite with current",
          )!;
          await button.onClick!();

          expect(session.saveToServer).toHaveBeenCalledTimes(1);
          expect(session.resumeSavedPuzzle).not.toHaveBeenCalled();
          expect(clock.start).toHaveBeenCalledTimes(1);
        });

        it("loads the saved puzzle and restarts the clock when the user chooses to resume", async () => {
          await useAuth().login("a@b.com", "x");

          const button = useDialog().dialogState.value!.buttons.find(
            (b) => b.text === "Resume unfinished",
          )!;
          await button.onClick!();

          expect(session.resumeSavedPuzzle).toHaveBeenCalledWith("saved-1");
          expect(session.saveToServer).not.toHaveBeenCalled();
          expect(clock.start).toHaveBeenCalledTimes(1);
        });

        async function chooseResume() {
          await useAuth().login("a@b.com", "x");
          const button = useDialog().dialogState.value!.buttons.find(
            (b) => b.text === "Resume unfinished",
          )!;
          await button.onClick!();
        }

        it("opens the resumed puzzle's page when it is a different difficulty", async () => {
          // Otherwise the easy page would show the hard puzzle's board.
          route.params = { difficulty: "easy" };
          session.resumeSavedPuzzle.mockResolvedValue(resumedPuzzle("hard"));

          await chooseResume();

          expect(router.push).toHaveBeenCalledExactlyOnceWith({
            name: "sudoku",
            params: { difficulty: "hard" },
          });
        });

        it("stays on the page when the resumed puzzle is that page's difficulty", async () => {
          route.params = { difficulty: "hard" };
          session.resumeSavedPuzzle.mockResolvedValue(resumedPuzzle("hard"));

          await chooseResume();

          expect(router.push).not.toHaveBeenCalled();
        });

        it("stays on the page when the resumed puzzle has no difficulty", async () => {
          route.params = { difficulty: "easy" };

          await chooseResume();

          expect(router.push).not.toHaveBeenCalled();
        });

        it("stays on the page when resuming fails", async () => {
          route.params = { difficulty: "easy" };
          session.resumeSavedPuzzle.mockResolvedValue({ success: false, status: 503, error: "Server down" });

          await chooseResume();

          expect(router.push).not.toHaveBeenCalled();
        });

        it("stays on the page when the user chooses to overwrite", async () => {
          route.params = { difficulty: "easy" };
          await useAuth().login("a@b.com", "x");

          const button = useDialog().dialogState.value!.buttons.find(
            (b) => b.text === "Overwrite with current",
          )!;
          await button.onClick!();

          expect(router.push).not.toHaveBeenCalled();
        });

        // saveToServer and resumeSavedPuzzle report failure by returning
        // { success: false }; they don't throw.
        it.each([
          ["overwrite", "Overwrite with current", () => session.saveToServer],
          ["resume", "Resume unfinished", () => session.resumeSavedPuzzle],
        ])(
          "shows the server's error and still restarts the clock when %s fails",
          async (_, text, handler) => {
            handler().mockResolvedValue({ success: false, status: 503, error: "Server down" });
            await useAuth().login("a@b.com", "x");

            const button = useDialog().dialogState.value!.buttons.find(
              (b) => b.text === text,
            )!;
            await expect(button.onClick!()).resolves.toBeUndefined();

            expectErrorToast("Server down");
            expect(clock.start).toHaveBeenCalledTimes(1);
          },
        );

        it.each([
          ["overwrite", "Overwrite with current", () => session.saveToServer],
          ["resume", "Resume unfinished", () => session.resumeSavedPuzzle],
        ])(
          "shows a readable error when %s fails without a message",
          async (_, text, handler) => {
            handler().mockResolvedValue({ success: false, status: 500 });
            await useAuth().login("a@b.com", "x");

            const button = useDialog().dialogState.value!.buttons.find(
              (b) => b.text === text,
            )!;
            await button.onClick!();

            expectErrorToast(); // also rejects "undefined" / "Cannot read"
          },
        );
      });
    });
  });

  describe("logout", () => {
    it("clears the user on success", async () => {
      svc.logout.mockResolvedValue({ success: true, status: 200 });
      const userStore = useUserStore();
      userStore.set(makeUser());

      await useAuth().logout();

      expect(userStore.isAuthenticated).toBe(false);
      expect(userStore.loading).toBe(false);
      expect(toastError).not.toHaveBeenCalled();
    });

    it("still clears the user locally when the server call fails", async () => {
      svc.logout.mockResolvedValue({
        success: false,
        status: 500,
        error: "boom",
      });
      const userStore = useUserStore();
      userStore.set(makeUser());

      await useAuth().logout();

      expect(userStore.isAuthenticated).toBe(false);
      expectErrorToast("boom");
    });

    it("falls back to a generic message when logout fails without an error", async () => {
      svc.logout.mockResolvedValue({ success: false, status: 500 });

      await useAuth().logout();

      expectErrorToast();
    });

    it("shows an error and resets loading when the service throws", async () => {
      svc.logout.mockRejectedValue(new Error("network down"));
      const userStore = useUserStore();

      await useAuth().logout();

      expectErrorToast("network down");
      expect(userStore.loading).toBe(false);
    });
  });

  describe("register", () => {
    it("sets the user and welcomes them on success", async () => {
      svc.register.mockResolvedValue({
        success: true,
        status: 201,
        body: { user: makeUser() },
      });
      const userStore = useUserStore();

      await useAuth().register("player@example.com", "Secret1!", "player", true);

      expect(svc.register).toHaveBeenCalledWith(
        "player@example.com",
        "Secret1!",
        "player",
        true,
      );
      expect(userStore.id).toBe("user-1");
      expect(userStore.loading).toBe(false);
      expect(toastSuccess).toHaveBeenCalledOnce();
      expect(toastText(toastSuccess.mock.calls[0]!)).toContain("player");
    });

    it("saves the puzzle in progress to the new account", async () => {
      svc.register.mockResolvedValue({
        success: true,
        status: 201,
        body: { user: makeUser() },
      });
      useGameStore().puzzleId = "local-1";

      await useAuth().register("a@b.com", "Secret1!", "player", true);

      expect(session.saveToServer).toHaveBeenCalledTimes(1);
    });

    it.each([
      ["with the server's message", { success: false as const, status: 503, error: "Server down" }, "Server down"],
      ["without a message", { success: false as const, status: 500 }, undefined],
    ])("keeps the new account, and shows an error, when saving the puzzle fails %s", async (_, failure, detail) => {
      svc.register.mockResolvedValue({
        success: true,
        status: 201,
        body: { user: makeUser() },
      });
      useGameStore().puzzleId = "local-1";
      session.saveToServer.mockResolvedValue(failure);

      await useAuth().register("a@b.com", "Secret1!", "player", true);

      expect(useUserStore().isAuthenticated).toBe(true);
      expect(useUserStore().loading).toBe(false);
      expectErrorToast(detail);
    });

    it("does not save when there is no puzzle in progress", async () => {
      svc.register.mockResolvedValue({
        success: true,
        status: 201,
        body: { user: makeUser() },
      });

      await useAuth().register("a@b.com", "Secret1!", "player", true);

      expect(session.saveToServer).not.toHaveBeenCalled();
    });

    it("shows the server error when registration fails", async () => {
      svc.register.mockResolvedValue({
        success: false,
        status: 409,
        error: "Email taken",
      });
      const userStore = useUserStore();

      await useAuth().register("a@b.com", "Secret1!", "player", true);

      expect(userStore.isAuthenticated).toBe(false);
      expect(userStore.loading).toBe(false);
      expectErrorToast("Email taken");
      expect(toastSuccess).not.toHaveBeenCalled();
    });

    it("falls back to a generic message when registration fails without an error", async () => {
      svc.register.mockResolvedValue({ success: false, status: 500 });

      await useAuth().register("a@b.com", "Secret1!", "player", true);

      expectErrorToast();
    });

    it("shows an error when the response has no user", async () => {
      svc.register.mockResolvedValue({ success: true, status: 201 });
      const userStore = useUserStore();

      await useAuth().register("a@b.com", "Secret1!", "player", true);

      expect(userStore.isAuthenticated).toBe(false);
      expect(userStore.loading).toBe(false);
      expectErrorToast();
    });

    it("shows an error and resets loading when the service throws", async () => {
      svc.register.mockRejectedValue(new Error("network down"));
      const userStore = useUserStore();

      await useAuth().register("a@b.com", "Secret1!", "player", true);

      expect(userStore.loading).toBe(false);
      expectErrorToast("network down");
    });
  });

  describe("getSession", () => {
    it("restores the user when a session exists", async () => {
      svc.getSession.mockResolvedValue({
        success: true,
        status: 200,
        body: { user: makeUser() },
      });
      const userStore = useUserStore();

      await useAuth().getSession();

      expect(userStore.isAuthenticated).toBe(true);
    });

    it("leaves the user signed out when the session has no user", async () => {
      svc.getSession.mockResolvedValue({ success: true, status: 200, body: undefined });
      const userStore = useUserStore();

      await useAuth().getSession();

      expect(userStore.isAuthenticated).toBe(false);
    });

    it("leaves the user signed out when there is no session", async () => {
      svc.getSession.mockResolvedValue({ success: false, status: 401 });
      const userStore = useUserStore();

      await useAuth().getSession();

      expect(userStore.isAuthenticated).toBe(false);
      expect(toastError).not.toHaveBeenCalled();
    });
  });

  describe("requestPasswordReset", () => {
    it("returns true on success", async () => {
      svc.requestPasswordReset.mockResolvedValue({ success: true, status: 200 });

      expect(await useAuth().requestPasswordReset("a@b.com")).toBe(true);
      expect(svc.requestPasswordReset).toHaveBeenCalledWith("a@b.com");
      expect(toastError).not.toHaveBeenCalled();
    });

    it("shows an error and returns false on failure", async () => {
      svc.requestPasswordReset.mockResolvedValue({ success: false, status: 500 });

      expect(await useAuth().requestPasswordReset("a@b.com")).toBe(false);
      expectErrorToast();
    });
  });

  describe("resetPassword", () => {
    it("returns true and resets loading on success", async () => {
      svc.resetPassword.mockResolvedValue({ success: true, status: 200 });
      const userStore = useUserStore();

      expect(await useAuth().resetPassword("token", "NewSecret1!")).toBe(true);
      expect(svc.resetPassword).toHaveBeenCalledWith("token", "NewSecret1!");
      expect(userStore.loading).toBe(false);
    });

    it("signs the user out after a successful reset", async () => {
      svc.resetPassword.mockResolvedValue({ success: true, status: 200 });
      const userStore = useUserStore();
      userStore.set(makeUser());

      await useAuth().resetPassword("token", "NewSecret1!");

      expect(userStore.isAuthenticated).toBe(false);
    });

    it("shows an error and returns false on failure", async () => {
      svc.resetPassword.mockResolvedValue({
        success: false,
        status: 400,
        error: "Token expired",
      });

      expect(await useAuth().resetPassword("token", "NewSecret1!")).toBe(false);
      expectErrorToast("Token expired");
    });

    it("resets loading when the reset fails", async () => {
      svc.resetPassword.mockResolvedValue({ success: false, status: 400 });
      const userStore = useUserStore();

      await useAuth().resetPassword("token", "NewSecret1!");

      expect(userStore.loading).toBe(false);
    });

    it("shows an error, returns false and resets loading when the service throws", async () => {
      svc.resetPassword.mockRejectedValue(new Error("network down"));
      const userStore = useUserStore();

      expect(await useAuth().resetPassword("token", "NewSecret1!")).toBe(false);
      expectErrorToast("network down");
      expect(userStore.loading).toBe(false);
    });
  });

  describe("requestEmailVerification", () => {
    it("confirms the email was sent on success", async () => {
      svc.requestEmailVerification.mockResolvedValue({ success: true, status: 200 });

      await useAuth().requestEmailVerification("a@b.com");

      expect(svc.requestEmailVerification).toHaveBeenCalledWith("a@b.com");
      expect(toastSuccess).toHaveBeenCalledOnce();
      expect(toastError).not.toHaveBeenCalled();
    });

    it("shows the server error on failure", async () => {
      svc.requestEmailVerification.mockResolvedValue({
        success: false,
        status: 429,
        error: "Too many requests",
      });

      await useAuth().requestEmailVerification("a@b.com");

      expectErrorToast("Too many requests");
      expect(toastSuccess).not.toHaveBeenCalled();
    });

    it("falls back to a generic message when it fails without an error", async () => {
      svc.requestEmailVerification.mockResolvedValue({ success: false, status: 500 });

      await useAuth().requestEmailVerification("a@b.com");

      expectErrorToast();
      expect(toastSuccess).not.toHaveBeenCalled();
    });
  });
});
