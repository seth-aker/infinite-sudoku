import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import PauseMenu from "@/components/PauseMenu.vue";
import { useGameStore } from "@/stores/gameStore";

// The real reka-ui dialog is used so closing goes through its actual behaviour.
// Its content is teleported to <body>, so queries go through the document.
let wrapper: VueWrapper | undefined;

async function mountMenu(open: boolean) {
  wrapper = mount(PauseMenu, { props: { open }, attachTo: document.body });
  await flushPromises();
  return wrapper;
}

function menu() {
  return document.querySelector('[role="dialog"]');
}

function resumeButton() {
  return [...document.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === "Resume",
  )!;
}

describe("PauseMenu", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    document.body.innerHTML = "";
  });

  it("is hidden when not open", async () => {
    await mountMenu(false);

    expect(menu()).toBeNull();
  });

  it("shows the game time and progress when open", async () => {
    const store = useGameStore();
    store.elapsedSeconds = 125;
    for (let i = 0; i < 41; i++) store.cells[i].value = 1;

    await mountMenu(true);

    expect(menu()?.textContent).toContain("Game Paused");
    expect(menu()?.textContent).toContain("2:05");
    expect(menu()?.textContent).toContain("51%");
  });

  it("emits resume once when the Resume button is clicked", async () => {
    const w = await mountMenu(true);

    resumeButton().click();
    await flushPromises();

    expect(w.emitted("resume")).toHaveLength(1);
  });

  it("emits resume when dismissed with Escape", async () => {
    const w = await mountMenu(true);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await flushPromises();

    expect(w.emitted("resume")).toHaveLength(1);
  });

  it("does not change the game itself", async () => {
    const store = useGameStore();
    store.state = "paused";
    await mountMenu(true);

    resumeButton().click();
    await flushPromises();

    // Resuming is the parent's job; the menu only reports the request.
    expect(store.state).toBe("paused");
    expect(store.isTimerRunning).toBe(false);
  });

  it("closes when the parent sets open to false", async () => {
    const w = await mountMenu(true);

    await w.setProps({ open: false });
    await flushPromises();

    expect(menu()).toBeNull();
    expect(w.emitted("resume")).toBeUndefined();
  });
});
