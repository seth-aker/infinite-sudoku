import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, RouterLinkStub, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import LoginForm from "@/components/loginRegister/LoginForm.vue";
import { useUserStore } from "@/stores/userStore";

// What happens after a login attempt (toasts, user store, loading flag) is
// tested in useAuth.test.ts. Here login is a stand-in.
const login = vi.fn();
vi.mock("@/composables/useAuth", () => ({
  useAuth: () => ({ login }),
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
const PASSWORD = "Sudoku#99";
const SPINNER = '[data-icon="line-md:loading-twotone-loop"]';

let wrapper: VueWrapper | undefined;

async function mountForm() {
  wrapper = mount(LoginForm, {
    props: { popoverOpen: true },
    attachTo: document.body,
    global: { stubs: { RouterLink: RouterLinkStub } },
  });
  // Let the template ref resolve. Until it does, useMousePressed listens on
  // the whole window instead of the eye button.
  await flushPromises();
  return wrapper;
}

function input(w: VueWrapper, id: "email" | "password") {
  return w.find<HTMLInputElement>(`#${id}`);
}

async function fillIn(w: VueWrapper) {
  await input(w, "email").setValue(EMAIL);
  await input(w, "password").setValue(PASSWORD);
}

async function submit(w: VueWrapper) {
  await w.find("form").trigger("submit");
  await flushPromises();
}

function closedPopover(w: VueWrapper) {
  return (w.emitted("update:popover-open") ?? []).some(([open]) => open === false);
}

// A login that stays in flight until finish() is called, setting the loading
// flag the way the real useAuth.login does.
function pendingLogin() {
  let finish!: (ok: boolean) => void;
  login.mockImplementation(() => {
    const userStore = useUserStore();
    userStore.loading = true;
    return new Promise<boolean>((resolve) => {
      finish = (ok) => {
        userStore.loading = false;
        resolve(ok);
      };
    });
  });
  return (ok: boolean) => finish(ok);
}

describe("LoginForm", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    login.mockReset();
    login.mockResolvedValue(true);
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    document.body.innerHTML = "";
  });

  describe("submitting", () => {
    it("stops the browser's own form submit", async () => {
      const w = await mountForm();
      const event = new Event("submit", { cancelable: true });

      w.find("form").element.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
    });

    it("logs in with the entered email and password", async () => {
      const w = await mountForm();
      await fillIn(w);

      await submit(w);

      expect(login).toHaveBeenCalledExactlyOnceWith(EMAIL, PASSWORD);
    });

    it("closes the popover once login succeeds, not before", async () => {
      const finish = pendingLogin();
      const w = await mountForm();
      await fillIn(w);

      await submit(w);
      expect(closedPopover(w)).toBe(false);

      finish(true);
      await flushPromises();
      expect(closedPopover(w)).toBe(true);
    });

    it("keeps the popover open, with the details still filled in, when login fails", async () => {
      login.mockResolvedValue(false);
      const w = await mountForm();
      await fillIn(w);

      await submit(w);

      expect(closedPopover(w)).toBe(false);
      expect(input(w, "email").element.value).toBe(EMAIL);
      expect(input(w, "password").element.value).toBe(PASSWORD);
    });

    it("lets the user try again after a failed login", async () => {
      login.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
      const w = await mountForm();
      await fillIn(w);

      await submit(w);
      await submit(w);

      expect(login).toHaveBeenCalledTimes(2);
      expect(closedPopover(w)).toBe(true);
    });

    it("shows a spinner instead of Submit while logging in", async () => {
      const finish = pendingLogin();
      const w = await mountForm();
      await fillIn(w);
      expect(w.find('button[type="submit"]').text()).toBe("Submit");

      await submit(w);
      expect(w.find(SPINNER).exists()).toBe(true);
      expect(w.findAll("button").some((b) => b.text() === "Submit")).toBe(false);

      finish(false);
      await flushPromises();
      expect(w.find(SPINNER).exists()).toBe(false);
      expect(w.find('button[type="submit"]').text()).toBe("Submit");
    });

    // A button with no type inside a form is a submit button, so the spinner
    // must opt out or clicking it (or pressing Enter) logs in a second time.
    it("doesn't send a second login when the spinner is clicked", async () => {
      pendingLogin();
      const w = await mountForm();
      await fillIn(w);
      await submit(w);

      const spinner = w.find(SPINNER).element.closest("button")!;
      expect(spinner.type).toBe("button");
      expect(spinner.disabled).toBe(true);
      // With no submit button left, Enter in a field can't submit either.
      expect(w.find('button[type="submit"]').exists()).toBe(false);

      spinner.click();
      await flushPromises();

      expect(login).toHaveBeenCalledOnce();
    });
  });

  it("links Forgot Password? to the password reset request page", async () => {
    const w = await mountForm();

    const link = w.findComponent(RouterLinkStub);

    expect(link.text()).toBe("Forgot Password?");
    expect(link.props("to")).toEqual({ name: "request-password-reset" });
  });

  describe("show password", () => {
    function eyeButton(w: VueWrapper) {
      return w.find('button[type="button"]');
    }

    it("shows the password only while the eye button is held down", async () => {
      const w = await mountForm();
      expect(input(w, "password").attributes("type")).toBe("password");

      await eyeButton(w).trigger("mousedown");
      expect(input(w, "password").attributes("type")).toBe("text");
      expect(w.find('[data-icon="radix-icons:eye-open"]').exists()).toBe(true);

      window.dispatchEvent(new MouseEvent("mouseup"));
      await flushPromises();
      expect(input(w, "password").attributes("type")).toBe("password");
      expect(w.find('[data-icon="radix-icons:eye-closed"]').exists()).toBe(true);
    });

    it("keeps the eye button out of the tab order", async () => {
      const w = await mountForm();

      expect(eyeButton(w).attributes("tabindex")).toBe("-1");
    });
  });
});
