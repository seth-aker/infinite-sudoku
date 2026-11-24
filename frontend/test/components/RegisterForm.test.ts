import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import RegisterForm from "@/components/loginRegister/RegisterForm.vue";
import { useUserStore } from "@/stores/userStore";

// What happens after a registration attempt (toasts, user store, saving the
// puzzle) is tested in useAuth.test.ts. Here we only need register as a stand-in.
const register = vi.fn();
vi.mock("@/composables/useAuth", () => ({
  useAuth: () => ({ register }),
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
const VALID = {
  email: "player@example.com",
  username: "player1",
  password: "Sudoku#99",
  confirm: "Sudoku#99",
};
type Fields = typeof VALID;

const FIELD_IDS: Record<keyof Fields, string> = {
  email: "#email",
  username: "#username",
  password: "#password",
  confirm: "#confirm-password",
};

let wrapper: VueWrapper | undefined;

async function mountForm() {
  wrapper = mount(RegisterForm, {
    props: { popoverOpen: true },
    attachTo: document.body,
  });
  // Let the template refs resolve. Until they do, useMousePressed listens on
  // the whole window instead of the eye buttons.
  await flushPromises();
  return wrapper;
}

function input(w: VueWrapper, field: keyof Fields) {
  return w.find<HTMLInputElement>(FIELD_IDS[field]);
}

async function type(w: VueWrapper, values: Partial<Fields>) {
  for (const [field, value] of Object.entries(values)) {
    await input(w, field as keyof Fields).setValue(value);
  }
}

async function waitForValidation() {
  await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
  await flushPromises();
}

async function fillAndValidate(w: VueWrapper, values: Partial<Fields>) {
  await type(w, values);
  await waitForValidation();
}

// FieldError renders an empty element even when there's no error, so only
// count the ones that have text.
const PASSWORD_RULES = /^Password must contain a minimum of 8 characters/;
const MISMATCH = "Password does not match!";

function errors(w: VueWrapper) {
  return w
    .findAll('[data-slot="field-error"]')
    .map((e) => e.text())
    .filter(Boolean);
}

function submitButton(w: VueWrapper) {
  return w.find<HTMLButtonElement>('button[type="submit"]');
}

async function submit(w: VueWrapper) {
  await w.find("form").trigger("submit");
  await flushPromises();
}

function closedPopover(w: VueWrapper) {
  return (w.emitted("update:popover-open") ?? []).some(([open]) => open === false);
}

describe("RegisterForm", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    // Only fake setTimeout so flushPromises (which uses setImmediate) still works.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    register.mockReset();
    register.mockResolvedValue(true);
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    document.body.innerHTML = "";
    vi.useRealTimers();
  });

  describe("live validation", () => {
    it("shows no errors before the user types", async () => {
      const w = await mountForm();

      expect(errors(w)).toEqual([]);
      expect(submitButton(w).element.disabled).toBe(false);
    });

    it("waits for the user to stop typing before checking", async () => {
      const w = await mountForm();

      await type(w, { email: "nope" });
      await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 1);
      expect(errors(w)).toEqual([]);

      await vi.advanceTimersByTimeAsync(1);
      await flushPromises();
      expect(errors(w)).toEqual(["Email Invalid"]);
    });

    it("flags an invalid email and clears it once fixed", async () => {
      const w = await mountForm();

      await fillAndValidate(w, { email: "player@" });
      expect(errors(w)).toEqual(["Email Invalid"]);
      expect(input(w, "email").attributes("aria-invalid")).toBe("true");

      await fillAndValidate(w, { email: VALID.email });
      expect(errors(w)).toEqual([]);
      expect(input(w, "email").attributes("aria-invalid")).toBe("false");
    });

    it("requires a username of at least 4 characters", async () => {
      const w = await mountForm();

      await fillAndValidate(w, { username: "abc" });
      expect(errors(w)).toEqual(["Username invalid. Must be 4 characters or longer."]);

      await fillAndValidate(w, { username: "abcd" });
      expect(errors(w)).toEqual([]);
    });

    it.each([
      ["too short", "Ab1#xyz"],
      ["no uppercase", "sudoku#99"],
      ["no lowercase", "SUDOKU#99"],
      ["no number", "Sudoku#!!"],
      ["no special character", "Sudoku999"],
    ])("rejects a password with %s", async (_reason, password) => {
      const w = await mountForm();

      await fillAndValidate(w, { password });

      expect(errors(w).filter((e) => PASSWORD_RULES.test(e))).toHaveLength(1);
    });

    it("accepts a strong password", async () => {
      const w = await mountForm();

      await fillAndValidate(w, { password: VALID.password });

      expect(errors(w).filter((e) => PASSWORD_RULES.test(e))).toEqual([]);
    });

    it("doesn't flag the confirmation before the user has typed it", async () => {
      const w = await mountForm();

      await fillAndValidate(w, { password: VALID.password });

      expect(errors(w)).not.toContain(MISMATCH);
      expect(submitButton(w).element.disabled).toBe(false);
    });

    it("flags a confirmation that doesn't match the password", async () => {
      const w = await mountForm();

      await fillAndValidate(w, { password: VALID.password, confirm: "Sudoku#98" });
      expect(errors(w)).toEqual(["Password does not match!"]);

      await fillAndValidate(w, { confirm: VALID.password });
      expect(errors(w)).toEqual([]);
    });

    it.each<[string, Partial<Fields>]>([
      ["the email", { email: "x" }],
      ["the username", { username: "x" }],
      // Confirm matches the weak password, so only the password error shows.
      ["the password", { password: "x", confirm: "x" }],
      ["the confirmation", { confirm: "mismatch" }],
    ])("disables Create Account while %s is invalid", async (_field, bad) => {
      const w = await mountForm();

      await fillAndValidate(w, { ...VALID, ...bad });
      expect(errors(w)).toHaveLength(1);
      expect(submitButton(w).element.disabled).toBe(true);

      // Fix the same fields again, password before confirm.
      const fix = Object.fromEntries(
        Object.keys(bad).map((k) => [k, VALID[k as keyof Fields]]),
      );
      await fillAndValidate(w, fix);
      expect(errors(w)).toEqual([]);
      expect(submitButton(w).element.disabled).toBe(false);
    });

    it("re-checks the confirmation when the password changes", async () => {
      const w = await mountForm();

      await fillAndValidate(w, { password: "Sudoku#9", confirm: VALID.password });
      expect(errors(w)).toEqual(["Password does not match!"]);

      await fillAndValidate(w, { password: VALID.password });
      expect(errors(w)).toEqual([]);
      expect(submitButton(w).element.disabled).toBe(false);
    });
  });

  describe("submitting", () => {
    it("stops the browser's own form submit", async () => {
      const w = await mountForm();
      await type(w, VALID);
      const event = new Event("submit", { cancelable: true });

      w.find("form").element.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
    });

    it("registers with the entered details and accepts the ToS", async () => {
      const w = await mountForm();
      await type(w, VALID);

      await submit(w);

      expect(register).toHaveBeenCalledExactlyOnceWith(
        VALID.email,
        VALID.password,
        VALID.username,
        true,
      );
    });

    // Submitting checks every field itself, so this also covers pressing Enter
    // before the debounced checks have run.
    it.each<[string, Partial<Fields>]>([
      ["the email is invalid", { email: "player@" }],
      ["the username is too short", { username: "abc" }],
      ["the password is weak", { password: "password", confirm: "password" }],
      ["the passwords don't match", { confirm: "Sudoku#98" }],
    ])("does not register when %s", async (_reason, override) => {
      const w = await mountForm();
      await type(w, { ...VALID, ...override });

      await submit(w);

      expect(register).not.toHaveBeenCalled();
    });

    it("closes the popover once registration succeeds, not before", async () => {
      let finish!: (ok: boolean) => void;
      register.mockReturnValue(new Promise<boolean>((resolve) => (finish = resolve)));
      const w = await mountForm();
      await type(w, VALID);

      await submit(w);
      expect(closedPopover(w)).toBe(false);

      finish(true);
      await flushPromises();
      expect(closedPopover(w)).toBe(true);
    });

    it("keeps the popover open, with the details still filled in, when registration fails", async () => {
      register.mockResolvedValue(false);
      const w = await mountForm();
      await type(w, VALID);

      await submit(w);

      expect(closedPopover(w)).toBe(false);
      expect(input(w, "email").element.value).toBe(VALID.email);
      expect(input(w, "username").element.value).toBe(VALID.username);
    });

    it("shows a spinner instead of Create Account while loading", async () => {
      const userStore = useUserStore();
      const w = await mountForm();
      expect(submitButton(w).text()).toBe("Create Account");

      userStore.loading = true;
      await flushPromises();

      expect(submitButton(w).exists()).toBe(false);
      expect(w.find('[data-icon="line-md:loading-twotone-loop"]').exists()).toBe(true);
    });

    // A button with no type inside a form is a submit button, so the spinner
    // must opt out or clicking it (or pressing Enter) registers a second time.
    it("doesn't register again when the spinner is clicked", async () => {
      const userStore = useUserStore();
      register.mockImplementation(() => {
        userStore.loading = true;
        return new Promise<boolean>(() => {});
      });
      const w = await mountForm();
      await type(w, VALID);
      await submit(w);

      const spinner = w
        .find('[data-icon="line-md:loading-twotone-loop"]')
        .element.closest("button")!;
      expect(spinner.type).toBe("button");
      expect(spinner.disabled).toBe(true);
      // With no submit button left, Enter in a field can't submit either.
      expect(submitButton(w).exists()).toBe(false);

      spinner.click();
      await flushPromises();

      expect(register).toHaveBeenCalledOnce();
    });
  });

  describe("show password", () => {
    function eyeButtons(w: VueWrapper) {
      return w.findAll('button[type="button"]');
    }

    it.each<[keyof Fields, number]>([
      ["password", 0],
      ["confirm", 1],
    ])("shows %s only while the eye button is held down", async (field, buttonIdx) => {
      const w = await mountForm();
      const other: keyof Fields = field === "password" ? "confirm" : "password";
      expect(input(w, field).attributes("type")).toBe("password");

      await eyeButtons(w)[buttonIdx]!.trigger("mousedown");
      expect(input(w, field).attributes("type")).toBe("text");
      expect(input(w, other).attributes("type")).toBe("password");
      expect(w.find('[data-icon="radix-icons:eye-open"]').exists()).toBe(true);

      window.dispatchEvent(new MouseEvent("mouseup"));
      await flushPromises();
      expect(input(w, field).attributes("type")).toBe("password");
    });

    it("keeps the eye buttons out of the tab order and from submitting", async () => {
      const w = await mountForm();

      for (const btn of eyeButtons(w)) {
        expect(btn.attributes("tabindex")).toBe("-1");
      }
      expect(eyeButtons(w)).toHaveLength(2);
    });
  });
});
