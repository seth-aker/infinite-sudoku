import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import RequestEmailVerificationView from "@/views/RequestEmailVerificationView.vue";

// requestEmailVerification shows its own success and error toasts; those are
// tested in useAuth.test.ts.
const requestEmailVerification = vi.fn();
vi.mock("@/composables/useAuth", () => ({
  useAuth: () => ({ requestEmailVerification }),
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

const EMAIL = "player@example.com";
const DEBOUNCE_MS = 500;
const INVALID = "Invalid email.";

let wrapper: VueWrapper | undefined;

async function mountView() {
  wrapper = mount(RequestEmailVerificationView, { attachTo: document.body });
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

describe("RequestEmailVerificationView", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    requestEmailVerification.mockReset();
    requestEmailVerification.mockResolvedValue(undefined);
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
      expect(w.find("#email").attributes("aria-invalid")).toBe("false");
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

  it("stops the browser's own form submit", async () => {
    const w = await mountView();
    const event = new Event("submit", { cancelable: true });

    w.find("form").element.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it.each(["", "player", "player@", "@example.com", "player@example"])(
    "shows the error and keeps the form usable for %j",
    async (value) => {
      const w = await mountView();
      await typeEmail(w, value);

      await submit(w);

      expect(errors(w)).toEqual([INVALID]);
      expect(w.find("#email").attributes("aria-invalid")).toBe("true");
      expect(requestEmailVerification).not.toHaveBeenCalled();
      expect(w.find("form").exists()).toBe(true);
      expect(w.find('button[type="submit"]').exists()).toBe(true);
    },
  );

  it("requests verification for the entered email", async () => {
    const w = await mountView();
    await typeEmail(w, EMAIL);

    await submit(w);

    expect(requestEmailVerification).toHaveBeenCalledExactlyOnceWith(EMAIL);
  });

  it("clears an earlier error once a valid email is submitted", async () => {
    const w = await mountView();
    await typeEmail(w, "player@");
    await submit(w);

    await typeEmail(w, EMAIL);
    await submit(w);

    expect(errors(w)).toEqual([]);
    expect(w.find("#email").attributes("aria-invalid")).toBe("false");
    expect(requestEmailVerification).toHaveBeenCalledExactlyOnceWith(EMAIL);
  });

  it("brings the form back, with the email kept, after the request finishes", async () => {
    const w = await mountView();
    await typeEmail(w, EMAIL);

    await submit(w);

    expect(w.find("form").exists()).toBe(true);
    expect((w.find("#email").element as HTMLInputElement).value).toBe(EMAIL);
  });

  it("shows the loading overlay while the request is in flight", async () => {
    let finish!: () => void;
    requestEmailVerification.mockReturnValue(new Promise<void>((r) => (finish = r)));
    const w = await mountView();
    await typeEmail(w, EMAIL);

    await submit(w);
    expect(w.find("form").exists()).toBe(false);
    expect(w.text()).toContain("Loading");

    finish();
    await flushPromises();
    expect(w.find("form").exists()).toBe(true);
  });

  it("lets the user send another request afterwards", async () => {
    const w = await mountView();
    await typeEmail(w, EMAIL);

    await submit(w);
    await submit(w);

    expect(requestEmailVerification).toHaveBeenCalledTimes(2);
  });
});
