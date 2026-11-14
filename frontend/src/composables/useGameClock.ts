import { useGameStore } from "@/stores/gameStore";
import { computed } from "vue";

export function useGameClock() {
  const gameStore = useGameStore();
  const isRunning = computed(() => gameStore.isTimerRunning );
  return {
    start: gameStore.startClock,
    pause: gameStore.pauseClock,
    halt: gameStore.haltClock,
    reset: gameStore.resetClock,
    isRunning,
  };
}
