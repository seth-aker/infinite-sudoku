import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import LoginPopover from "@/components/loginRegister/LoginPopover.vue";
import LoginDrawer from "@/components/loginRegister/LoginDrawer.vue";
import { useGameStore } from "@/stores/gameStore";

// The forms have their own tests. Here they're stubbed so we only test the
// container opening and closing.
const stubs = { LoginForm: true, RegisterForm: true };

let wrapper: VueWrapper | undefined;

function loginButton() {
  return [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Login")!;
}

// Both containers clear the selected cell when they open, so typing in the
// login form doesn't also enter digits into the puzzle.
describe.each([
  ["LoginPopover", LoginPopover],
  ["LoginDrawer", LoginDrawer],
])("%s", (_name, component) => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    document.body.innerHTML = "";
  });

  async function mountIt() {
    wrapper = mount(component, { attachTo: document.body, global: { stubs } });
    await flushPromises();
    return wrapper;
  }

  async function setOpen(open: boolean) {
    // Drive the container's own v-model the way reka-ui/vaul would.
    const root = wrapper!.findComponent({ name: _name === "LoginPopover" ? "Popover" : "Drawer" });
    root.vm.$emit("update:open", open);
    await flushPromises();
  }

  it("clears the selected cell when it opens", async () => {
    const store = useGameStore();
    store.selectedIdx = 40;
    await mountIt();

    loginButton().click();
    await flushPromises();

    expect(store.selectedIdx).toBeUndefined();
  });

  it("leaves the selection alone when it closes", async () => {
    const store = useGameStore();
    await mountIt();
    await setOpen(true);

    store.selectedIdx = 40;
    await setOpen(false);

    expect(store.selectedIdx).toBe(40);
  });

  it("leaves the selection alone until it is opened", async () => {
    const store = useGameStore();
    store.selectedIdx = 40;

    await mountIt();

    expect(store.selectedIdx).toBe(40);
  });
});
