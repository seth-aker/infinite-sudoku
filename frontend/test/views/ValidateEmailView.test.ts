import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import ValidateEmailView from "@/views/ValidateEmailView.vue";
import type { ServiceResult } from "@/services/baseService";

// The view calls the service directly (not through useAuth), so the service is
// what gets mocked. Its request format is tested in userService.test.ts.
const validateEmail = vi.fn<(token: string) => Promise<ServiceResult<void>>>();
vi.mock("@/services/userService", () => ({
  validateEmail: (token: string) => validateEmail(token),
}));

const route: { query: Record<string, unknown> } = { query: {} };
const push = vi.fn();
vi.mock("vue-router", () => ({
  useRoute: () => route,
  useRouter: () => ({ push }),
}));

const TOKEN = "0b3c8f4e-6a1d-4c2b-9e7f-1a2b3c4d5e6f";
const VERIFIED = "Email Verified!";
const OOPS = "Oops! An error occurred.";

let wrapper: VueWrapper | undefined;

async function mountView() {
  wrapper = mount(ValidateEmailView);
  await flushPromises();
  return wrapper;
}

function goHomeButton(w: VueWrapper) {
  return w.findAll("button").find((b) => b.text() === "Go home");
}

function expectError(w: VueWrapper) {
  expect(w.text()).toContain(OOPS);
  expect(w.text()).not.toContain(VERIFIED);
  expect(goHomeButton(w)).toBeDefined();
}

describe("ValidateEmailView", () => {
  beforeEach(() => {
    route.query = { token: TOKEN };
    validateEmail.mockReset();
    validateEmail.mockResolvedValue({ success: true, status: 200 });
    push.mockReset();
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  describe("with a valid token", () => {
    it("sends the token from the link to the server once", async () => {
      await mountView();

      expect(validateEmail).toHaveBeenCalledExactlyOnceWith(TOKEN);
    });

    it("says the email is verified when the server accepts it", async () => {
      const w = await mountView();

      expect(w.text()).toContain(VERIFIED);
      expect(w.text()).not.toContain(OOPS);
      expect(goHomeButton(w)).toBeUndefined();
    });

    it("shows the loading overlay until the server answers", async () => {
      let finish!: (res: ServiceResult<void>) => void;
      validateEmail.mockReturnValue(new Promise((r) => (finish = r)));
      const w = await mountView();

      expect(w.text()).toContain("Loading");
      expect(w.text()).not.toContain(VERIFIED);

      finish({ success: true, status: 200 });
      await flushPromises();
      expect(w.text()).not.toContain("Loading");
      expect(w.text()).toContain(VERIFIED);
    });

    it("shows the server's error when it rejects the token", async () => {
      validateEmail.mockResolvedValue({
        success: false,
        status: 400,
        error: "Token has expired",
      });
      const w = await mountView();

      expectError(w);
      expect(w.text()).toContain("Token has expired");
    });

    // safeFetch leaves `error` undefined when the error response isn't JSON
    // (e.g. a proxy's 502 page). The view treats a missing message as
    // success and tells the user their email is verified.
    it("shows an error when the server fails without a message", async () => {
      validateEmail.mockResolvedValue({ success: false, status: 502 });
      const w = await mountView();

      expectError(w);
    });
  });

  describe("with a bad token", () => {
    it.each([
      ["missing", undefined],
      ["empty", ""],
      ["not a UUID", "not-a-token"],
      ["repeated in the link", [TOKEN, TOKEN]],
    ])("shows an error without calling the server when the token is %s", async (_case, token) => {
      route.query = { token };
      const w = await mountView();

      expect(validateEmail).not.toHaveBeenCalled();
      expectError(w);
    });

    // The view shows zod's error.message, which is the issue list as JSON,
    // including the UUID regex.
    it("shows a readable message rather than the raw validation output", async () => {
      route.query = { token: "not-a-token" };
      const w = await mountView();

      expect(w.text()).not.toMatch(/[[\]{}]|invalid_format|"code"/);
    });
  });

  it("goes home when Go home is clicked", async () => {
    route.query = {};
    const w = await mountView();

    await goHomeButton(w)!.trigger("click");

    expect(push).toHaveBeenCalledExactlyOnceWith({ name: "home" });
  });
});
