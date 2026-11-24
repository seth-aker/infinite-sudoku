import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import PasswordResetForm from "@/components/loginRegister/PasswordResetForm.vue";
import { useUserStore } from "@/stores/userStore";

// What resetPassword does with the server, the user store and its own error
// toasts is tested in useAuth.test.ts.
const resetPassword = vi.fn();
vi.mock("@/composables/useAuth", () => ({
  useAuth: () => ({ resetPassword }),
}));

const route = { query: {} as Record<string, unknown> };
const push = vi.fn();
vi.mock("vue-router", () => ({
  useRoute: () => route,
  useRouter: () => ({ push }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("vue-sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

vi.mock("@iconify/vue", async () => {
  const { defineComponent, h } = await import("vue");
  return {
    Icon: defineComponent({
      props: { icon: String },
      setup: (props) => () => h("i", { "data-icon": props.icon }),
    }),
  };
});

const TOKEN = "3f2b8c4e-9a1d-4e6f-b7c2-5d8e0a1b2c3d";
const STRONG = "Sudoku#99";
const PASSWORD_RULES = /^Password must contain a minimum of 8 characters/;
const MISMATCH = "Does not match password field!";

let wrapper: VueWrapper | undefined;

async function mountForm() {
  wrapper = mount(PasswordResetForm, { attachTo: document.body });
  await flushPromises();
  return wrapper;
}

async function fillAndSubmit(w: VueWrapper, password: string, confirm = password) {
  await w.find("#password").setValue(password);
  await w.find("#confirm-password").setValue(confirm);
  await w.find("form").trigger("submit");
  await flushPromises();
}

function errors(w: VueWrapper) {
  return w
    .findAll('[data-slot="field-error"]')
    .map((e) => e.text())
    .filter(Boolean);
}

describe("PasswordResetForm", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    route.query = { token: TOKEN };
    resetPassword.mockReset();
    resetPassword.mockResolvedValue(true);
    push.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    document.body.innerHTML = "";
  });

  it("shows no errors before submitting", async () => {
    const w = await mountForm();

    await w.find("#password").setValue("weak");

    expect(errors(w)).toEqual([]);
  });

  it("stops the browser's own form submit", async () => {
    const w = await mountForm();
    const event = new Event("submit", { cancelable: true });

    w.find("form").element.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  describe("validation", () => {
    it.each([
      ["too short", "Ab1#xyz"],
      ["no uppercase", "sudoku#99"],
      ["no lowercase", "SUDOKU#99"],
      ["no number", "Sudoku#!!"],
      ["no special character", "Sudoku999"],
    ])("rejects a password with %s", async (_reason, password) => {
      const w = await mountForm();

      await fillAndSubmit(w, password);

      expect(errors(w)).toHaveLength(1);
      expect(errors(w)[0]).toMatch(PASSWORD_RULES);
      expect(resetPassword).not.toHaveBeenCalled();
    });

    it("rejects a confirmation that doesn't match", async () => {
      const w = await mountForm();

      await fillAndSubmit(w, STRONG, "Sudoku#98");

      expect(errors(w)).toEqual([MISMATCH]);
      expect(resetPassword).not.toHaveBeenCalled();
    });

    it("reports a weak password before a mismatch", async () => {
      const w = await mountForm();

      await fillAndSubmit(w, "weak", "different");

      expect(errors(w)).toHaveLength(1);
      expect(errors(w)[0]).toMatch(PASSWORD_RULES);
    });

    it("clears old errors once the fields are fixed", async () => {
      const w = await mountForm();
      await fillAndSubmit(w, "weak");
      await fillAndSubmit(w, STRONG, "Sudoku#98");
      expect(errors(w)).toEqual([MISMATCH]);

      await fillAndSubmit(w, STRONG);

      expect(errors(w)).toEqual([]);
      expect(resetPassword).toHaveBeenCalledOnce();
    });

    it("checks the passwords before the token", async () => {
      route.query = {};
      const w = await mountForm();

      await fillAndSubmit(w, "weak");

      expect(errors(w)).toHaveLength(1);
      expect(toastError).not.toHaveBeenCalled();
    });
  });

  describe("reset token", () => {
    it.each<[string, Record<string, unknown>]>([
      ["missing", {}],
      ["not a UUID", { token: "not-a-token" }],
      ["empty", { token: "" }],
      ["repeated in the URL", { token: [TOKEN, TOKEN] }],
    ])("asks for a new link when the token is %s", async (_reason, query) => {
      route.query = query;
      const w = await mountForm();

      await fillAndSubmit(w, STRONG);

      expect(toastError).toHaveBeenCalledOnce();
      expect(toastError.mock.calls[0]![0]).toMatch(/reset token/i);
      expect(toastError.mock.calls[0]![1]).toMatchObject({
        description: expect.stringMatching(/re-request/i),
      });
      expect(resetPassword).not.toHaveBeenCalled();
      expect(push).not.toHaveBeenCalled();
    });
  });

  describe("submitting", () => {
    it("resets the password with the token from the link", async () => {
      const w = await mountForm();

      await fillAndSubmit(w, STRONG);

      expect(resetPassword).toHaveBeenCalledExactlyOnceWith(TOKEN, STRONG);
    });

    it("confirms the reset and goes home on success", async () => {
      const w = await mountForm();

      await fillAndSubmit(w, STRONG);

      expect(toastSuccess).toHaveBeenCalledOnce();
      expect(toastSuccess.mock.calls[0]![1]).toMatchObject({
        description: expect.stringMatching(/login/i),
      });
      expect(push).toHaveBeenCalledExactlyOnceWith({ name: "home" });
    });

    it("stays on the page when the reset fails", async () => {
      resetPassword.mockResolvedValue(false);
      const w = await mountForm();

      await fillAndSubmit(w, STRONG);

      expect(toastSuccess).not.toHaveBeenCalled();
      expect(push).not.toHaveBeenCalled();
      expect((w.find("#password").element as HTMLInputElement).value).toBe(STRONG);
    });

    it("shows a spinner instead of Submit while loading", async () => {
      const w = await mountForm();
      expect(w.find('button[type="submit"]').text()).toBe("Submit");

      useUserStore().loading = true;
      await flushPromises();

      expect(w.find('button[type="submit"]').exists()).toBe(false);
      expect(w.find('[data-icon="line-md:loading-twotone-loop"]').exists()).toBe(true);
    });
  });

  describe("show password", () => {
    it.each([
      ["#password", 0],
      ["#confirm-password", 1],
    ])("shows %s only while its eye button is held down", async (id, buttonIdx) => {
      const w = await mountForm();
      const field = () => w.find(id).attributes("type");

      await w.findAll('button[type="button"]')[buttonIdx]!.trigger("mousedown");
      expect(field()).toBe("text");

      window.dispatchEvent(new MouseEvent("mouseup"));
      await flushPromises();
      expect(field()).toBe("password");
    });
  });
});
