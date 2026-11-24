import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { flushPromises } from "@vue/test-utils";
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
};
vi.mock("@/composables/useGameSession", () => ({
  useGameSession: () => session,
}));

// usePuzzleNavigation is tested on its own (including where it navigates and
// how it reports failures); here we only care when useAuth asks it to resume.
const nav = {
  resumePuzzle: vi.fn(),
};
vi.mock("@/composables/usePuzzleNavigation", () => ({
  usePuzzleNavigation: () => nav,
}));

// The clock is tested on its own (gameStore / useGameClock); here we only
// care when useAuth starts and pauses it.
const clock = { start: vi.fn(), pause: vi.fn(), halt: vi.fn(), reset: vi.fn() };
vi.mock("@/composables/useGameClock", () => ({
  useGameClock: () => clock,
}));

const router = { push: vi.fn() };
vi.mock("vue-router", () => ({
  useRouter: () => router,
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

// A resume that only finishes when the returned function is called, so tests
// can check what happens before and after it completes.
function pendingResume() {
  let finish!: () => void;
  nav.resumePuzzle.mockReturnValue(new Promise<void>((r) => (finish = r)));
  return () => {
    finish();
    return flushPromises();
  };
}

describe("useAuth", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    session.saveToServer.mockResolvedValue({ success: true, status: 200 });
    nav.resumePuzzle.mockResolvedValue(undefined);
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
      beforeEach(() => {
        svc.login.mockResolvedValue({
          success: true,
          status: 200,
          body: { user: makeUser({ currentPuzzleId: "saved-1" }) },
        });
      });

      it("resumes the user's saved puzzle instead of saving", async () => {
        await useAuth().login("a@b.com", "x");

        expect(nav.resumePuzzle).toHaveBeenCalledOnce();
        expect(session.saveToServer).not.toHaveBeenCalled();
        expect(useDialog().isOpen.value).toBe(false);
      });

      it("resumes after the user is signed in, so the saved puzzle id is known", async () => {
        nav.resumePuzzle.mockImplementation(async () => {
          expect(useUserStore().isAuthenticated).toBe(true);
          expect(useUserStore().currentPuzzleId).toBe("saved-1");
        });

        await useAuth().login("a@b.com", "x");

        expect(nav.resumePuzzle).toHaveBeenCalledOnce();
      });

      it("stays loading, and doesn't finish logging in, until the puzzle is resumed", async () => {
        const finishResume = pendingResume();
        const userStore = useUserStore();
        let result: boolean | undefined;

        const login = useAuth().login("a@b.com", "x").then((r) => (result = r));
        await flushPromises();

        expect(userStore.loading).toBe(true);
        expect(result).toBeUndefined();

        await finishResume();
        await login;

        expect(userStore.loading).toBe(false);
        expect(result).toBe(true);
      });

      it("leaves navigation to the resume itself", async () => {
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

        expect(nav.resumePuzzle).not.toHaveBeenCalled();
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
        expect(nav.resumePuzzle).not.toHaveBeenCalled();
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
          expect(nav.resumePuzzle).not.toHaveBeenCalled();
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

        function dialogButton(text: string) {
          return useDialog().dialogState.value!.buttons.find((b) => b.text === text)!;
        }

        it("closes the dialog after either choice", async () => {
          await useAuth().login("a@b.com", "x");

          expect(useDialog().dialogState.value!.buttons.map((b) => [b.text, b.closeOnClick])).toEqual([
            ["Overwrite with current", true],
            ["Resume unfinished", true],
          ]);
        });

        it("saves the local puzzle and restarts the clock when the user chooses to overwrite", async () => {
          await useAuth().login("a@b.com", "x");

          await dialogButton("Overwrite with current").onClick!();

          expect(session.saveToServer).toHaveBeenCalledTimes(1);
          expect(nav.resumePuzzle).not.toHaveBeenCalled();
          expect(clock.start).toHaveBeenCalledTimes(1);
        });

        it("stays on the page when the user chooses to overwrite", async () => {
          await useAuth().login("a@b.com", "x");

          await dialogButton("Overwrite with current").onClick!();

          expect(router.push).not.toHaveBeenCalled();
        });

        // saveToServer reports failure by returning { success: false }; it doesn't throw.
        it("shows the server's error and still restarts the clock when overwriting fails", async () => {
          session.saveToServer.mockResolvedValue({ success: false, status: 503, error: "Server down" });
          await useAuth().login("a@b.com", "x");

          await expect(dialogButton("Overwrite with current").onClick!()).resolves.toBeUndefined();

          expectErrorToast("Server down");
          expect(clock.start).toHaveBeenCalledTimes(1);
        });

        it("shows a readable error when overwriting fails without a message", async () => {
          session.saveToServer.mockResolvedValue({ success: false, status: 500 });
          await useAuth().login("a@b.com", "x");

          await dialogButton("Overwrite with current").onClick!();

          expectErrorToast(); // also rejects "undefined" / "Cannot read"
        });

        it("still restarts the clock when overwriting throws", async () => {
          session.saveToServer.mockRejectedValue(new Error("network down"));
          await useAuth().login("a@b.com", "x");

          await expect(dialogButton("Overwrite with current").onClick!()).resolves.toBeUndefined();

          expectErrorToast("network down");
          expect(clock.start).toHaveBeenCalledTimes(1);
        });

        it("resumes the saved puzzle and restarts the clock when the user chooses to resume", async () => {
          await useAuth().login("a@b.com", "x");

          await dialogButton("Resume unfinished").onClick!();

          expect(nav.resumePuzzle).toHaveBeenCalledOnce();
          expect(session.saveToServer).not.toHaveBeenCalled();
          expect(clock.start).toHaveBeenCalledTimes(1);
        });

        it("keeps the clock stopped until the saved puzzle has loaded", async () => {
          await useAuth().login("a@b.com", "x");
          const finishResume = pendingResume();

          const click = dialogButton("Resume unfinished").onClick!();
          await flushPromises();

          expect(clock.start).not.toHaveBeenCalled();

          await finishResume();
          await click;

          expect(clock.start).toHaveBeenCalledOnce();
        });

        it("leaves navigation to the resume itself", async () => {
          await useAuth().login("a@b.com", "x");

          await dialogButton("Resume unfinished").onClick!();

          expect(router.push).not.toHaveBeenCalled();
        });
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

      const ok = await useAuth().register("player@example.com", "Secret1!", "player", true);

      expect(ok).toBe(true);
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

      const ok = await useAuth().register("a@b.com", "Secret1!", "player", true);

      expect(ok).toBe(true);
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

      const ok = await useAuth().register("a@b.com", "Secret1!", "player", true);

      // The account exists, so the form should close even though the save failed.
      expect(ok).toBe(true);
      expect(useUserStore().isAuthenticated).toBe(true);
      expect(useUserStore().loading).toBe(false);
      expectErrorToast(detail);
    });

    it("stays loading until registration finishes", async () => {
      let finish!: (v: Awaited<ReturnType<typeof svc.register>>) => void;
      svc.register.mockReturnValue(new Promise((resolve) => (finish = resolve)));
      const userStore = useUserStore();

      const pending = useAuth().register("a@b.com", "Secret1!", "player", true);
      expect(userStore.loading).toBe(true);

      finish({ success: true, status: 201, body: { user: makeUser() } });
      await pending;
      expect(userStore.loading).toBe(false);
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

      const ok = await useAuth().register("a@b.com", "Secret1!", "player", true);

      expect(ok).toBe(false);
      expect(userStore.isAuthenticated).toBe(false);
      expect(userStore.loading).toBe(false);
      expectErrorToast("Email taken");
      expect(toastSuccess).not.toHaveBeenCalled();
    });

    it("falls back to a generic message when registration fails without an error", async () => {
      svc.register.mockResolvedValue({ success: false, status: 500 });

      const ok = await useAuth().register("a@b.com", "Secret1!", "player", true);

      expect(ok).toBe(false);
      expectErrorToast();
    });

    it("shows an error when the response has no user", async () => {
      svc.register.mockResolvedValue({ success: true, status: 201 });
      const userStore = useUserStore();

      const ok = await useAuth().register("a@b.com", "Secret1!", "player", true);

      expect(ok).toBe(false);
      expect(userStore.isAuthenticated).toBe(false);
      expect(userStore.loading).toBe(false);
      expectErrorToast();
    });

    it("shows an error and resets loading when the service throws", async () => {
      svc.register.mockRejectedValue(new Error("network down"));
      const userStore = useUserStore();

      const ok = await useAuth().register("a@b.com", "Secret1!", "player", true);

      expect(ok).toBe(false);
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
