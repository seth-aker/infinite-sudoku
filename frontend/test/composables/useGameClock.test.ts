import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useGameClock } from "@/composables/useGameClock";
import { useGameStore } from "@/stores/gameStore";

// useGameClock is a thin wrapper over the store's clock (whose timing is tested
// in gameStore.test.ts). These tests check that it drives the real store.
describe("useGameClock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setActivePinia(createPinia());
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("start runs the store's clock", () => {
    const store = useGameStore();
    const clock = useGameClock();

    clock.start();
    vi.advanceTimersByTime(2000);

    expect(store.state).toBe("playing");
    expect(store.elapsedSeconds).toBe(2);
  });

  it("pause stops the store's clock and pauses the game", () => {
    const store = useGameStore();
    const clock = useGameClock();
    clock.start();

    clock.pause();
    vi.advanceTimersByTime(2000);

    expect(store.state).toBe("paused");
    expect(store.elapsedSeconds).toBe(0);
  });

  it("halt stops the store's clock without changing the game state", () => {
    const store = useGameStore();
    const clock = useGameClock();
    clock.start();

    clock.halt();
    vi.advanceTimersByTime(2000);

    expect(store.state).toBe("playing");
    expect(store.elapsedSeconds).toBe(0);
  });

  it("reset zeroes the store's time", () => {
    const store = useGameStore();
    const clock = useGameClock();
    clock.start();
    vi.advanceTimersByTime(3000);

    clock.reset();
    vi.advanceTimersByTime(2000);

    expect(clock.isRunning.value).toBe(false);
    expect(store.state).toBe("idle");
    expect(store.elapsedSeconds).toBe(0);
  });

  it("isRunning follows the store's timer", () => {
    const clock = useGameClock();
    expect(clock.isRunning.value).toBe(false);

    clock.start();
    expect(clock.isRunning.value).toBe(true);

    clock.pause();
    expect(clock.isRunning.value).toBe(false);
  });
});
