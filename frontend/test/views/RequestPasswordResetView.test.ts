import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import RequestPasswordResetView from "@/views/RequestPasswordResetView.vue";

// requestPasswordReset's own error toast is tested in useAuth.test.ts.
const requestPasswordReset = vi.fn();
vi.mock("@/composables/useAuth", () => ({
  useAuth: () => ({ requestPasswordReset }),
}));

const push = vi.fn();
vi.mock("vue-router", () => ({
  useRouter: () => ({ push }),
}));

const toastSuccess = vi.fn();
vi.mock("vue-sonner", () => ({
  toast: { success: (...args: unknown[]) => toastSuccess(...args) },
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

const DEBOUNCE_MS = 500;
const EMAIL = "player@example.com";
const INVALID = "Invalid email.";

let wrapper: VueWrapper | undefined;

async function mountView() {
  wrapper = mount(RequestPasswordResetView, { attachTo: document.body });
  await flushPromises();
  return wrapper;
}

function errors(w: VueWrapper) {
  return w
    .findAll('[data-slot="field-error"]')
    .map((e) => e.text())
    .filter(Boolean);
}

async function typeEmail(w: VueWrapper, value: string) {
  await w.find("#email").setValue(value);
}

async function waitForValidation() {
  await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
  await flushPromises();
}

async function submit(w: VueWrapper) {
  await w.find("form").trigger("submit");
  await flushPromises();
}

describe("RequestPasswordResetView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    requestPasswordReset.mockReset();
    requestPasswordReset.mockResolvedValue(true);
    push.mockReset();
    toastSuccess.mockReset();
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  describe("live validation", () => {
    it("shows no error before the user types", async () => {
      const w = await mountView();

      expect(errors(w)).toEqual([]);
    });

    it("flags an invalid email once the user stops typing", async () => {
      const w = await mountView();

      await typeEmail(w, "player@");
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1);
      expect(errors(w)).toEqual([]);

      await waitForValidation();
      expect(errors(w)).toEqual([INVALID]);
      expect(w.find("#email").attributes("aria-invalid")).toBe("true");
    });

    it("clears the error once the email is fixed", async () => {
      const w = await mountView();
      await typeEmail(w, "player@");
      await waitForValidation();

      await typeEmail(w, EMAIL);
      await waitForValidation();

      expect(errors(w)).toEqual([]);
      expect(w.find("#email").attributes("aria-invalid")).toBe("false");
    });
  });

  describe("submitting", () => {
    it("stops the browser's own form submit", async () => {
      const w = await mountView();
      const event = new Event("submit", { cancelable: true });

      w.find("form").element.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
    });

    it("shows the error and keeps the form usable when the email is invalid", async () => {
      const w = await mountView();
      await typeEmail(w, "player@");

      await submit(w);

      expect(errors(w)).toEqual([INVALID]);
      expect(requestPasswordReset).not.toHaveBeenCalled();
      expect(w.find("form").exists()).toBe(true);
      expect(w.find('button[type="submit"]').exists()).toBe(true);
    });

    it("requests a reset for the entered email", async () => {
      const w = await mountView();
      await typeEmail(w, EMAIL);

      await submit(w);

      expect(requestPasswordReset).toHaveBeenCalledExactlyOnceWith(EMAIL);
    });

    it("confirms the email was sent and goes home on success", async () => {
      const w = await mountView();
      await typeEmail(w, EMAIL);

      await submit(w);

      expect(toastSuccess).toHaveBeenCalledOnce();
      expect(push).toHaveBeenCalledExactlyOnceWith({ name: "home" });
    });

    it("brings the form back, with the email kept, when the request fails", async () => {
      requestPasswordReset.mockResolvedValue(false);
      const w = await mountView();
      await typeEmail(w, EMAIL);

      await submit(w);

      expect(toastSuccess).not.toHaveBeenCalled();
      expect(push).not.toHaveBeenCalled();
      expect((w.find("#email").element as HTMLInputElement).value).toBe(EMAIL);
    });

    it("shows the loading overlay while the request is in flight", async () => {
      let finish!: (ok: boolean) => void;
      requestPasswordReset.mockReturnValue(new Promise<boolean>((r) => (finish = r)));
      const w = await mountView();
      await typeEmail(w, EMAIL);

      await submit(w);
      expect(w.find("form").exists()).toBe(false);
      expect(w.text()).toContain("Loading");

      finish(false);
      await flushPromises();
      expect(w.find("form").exists()).toBe(true);
    });
  });
});
