import { defineStore } from "pinia";
import type { Difficulty } from "./models/difficulty";
import type { GameState } from "./models/gameState";
import { computed, ref } from "vue";
import { useIntervalFn } from "@vueuse/core";
import { useSudokuStore } from "./sudokuStore";

const ONE_MINUTE_SECONDS = 60;
const ONE_HOUR_SECONDS = 60 * ONE_MINUTE_SECONDS;
export const useGameStore = defineStore('gameStore', () => {
    const sudokuStore = useSudokuStore();
    const difficulty = ref<Difficulty | undefined>(undefined);
    const elapsedSeconds = ref(0)
    const gameState = ref<GameState>('not-started');
    const { pause, resume, isActive } = useIntervalFn(() => {
        elapsedSeconds.value++
        if(elapsedSeconds.value % 10 === 0) {
          sudokuStore.saveGameState()
        }
        saveElapsedSecondsLocal()
      },
      1000
    );
  
    function startTimer() {
      resume()
      gameState.value = 'playing'
    }
    function pauseGame() {
      pause()
      gameState.value = 'paused'
    }
    function clearElapsedSecondsLocal() {
      localStorage.removeItem('elapsedSeconds');
    }
    function saveElapsedSecondsLocal() {
      localStorage.setItem('elapsedSeconds', elapsedSeconds.value.toString())
    }
    function loadElapsedSecondsLocal() {
      const secondString = localStorage.getItem('elapsedSeconds');
      if(secondString !== null) {
        elapsedSeconds.value = Number.parseInt(secondString)
      }
    }
    const formattedElapsedTime = computed(() => {
      const hours = Math.floor(elapsedSeconds.value / ONE_HOUR_SECONDS);
      const mins = Math.floor((elapsedSeconds.value % ONE_HOUR_SECONDS) / ONE_MINUTE_SECONDS);
      const secs = (elapsedSeconds.value % ONE_HOUR_SECONDS) % ONE_MINUTE_SECONDS;
      let timeString = '';
      if(hours > 0) {
          timeString += `${hours}:`
      }
      if(hours > 0 && mins < 10) {
          timeString += `0${mins}:`
      } else {
          timeString += `${mins}:`
      }
      if(secs < 10) {
          timeString += `0${secs}`
      } else {
          timeString += secs.toString()
      }
      return timeString
  })
  return {
    difficulty,
    elapsedSeconds,
    gameState,
    startTimer,
    pauseGame,
    clearElapsedSecondsLocal,
    saveElapsedSecondsLocal,
    loadElapsedSecondsLocal,
    formattedElapsedTime,
    timerActive: isActive
  }
})
