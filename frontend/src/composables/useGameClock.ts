import { useGameStore } from "@/stores/gameStore";
import { useIntervalFn, type Pausable } from "@vueuse/core";
import { computed, effectScope } from "vue";
import { useGameSession } from "./useGameSession";

let interval: Pausable | undefined;
export function useGameClock() {
  const gameStore = useGameStore()
  if(!interval) {
    effectScope(true).run(() => {
      interval = useIntervalFn(() => {
        gameStore.elapsedSeconds++
        useGameSession().saveLocal()
      }, 1000, {immediate: false})
    })
  }
  function start() {
    gameStore.state = 'playing'
    interval?.resume()
  }
  function pause() {
    gameStore.state = 'paused'
    interval?.pause()
  }
  function halt() {
    interval?.pause()
  }
  function reset() {
    gameStore.elapsedSeconds = 0;
    interval?.pause()
    gameStore.state = 'idle'
  }
  const isRunning = computed(() => interval?.isActive ?? false)
  return {
    start,
    pause,
    halt,
    reset,
    isRunning
  }
}
