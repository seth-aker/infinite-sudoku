import { createBlankCells, isPuzzleSolved } from "@/utils/puzzleUtils";
import { defineStore } from "pinia";
import { computed, ref } from "vue";

export interface Cell {
  idx: number;
  value: number,
  candidates: number[]
}
export type DifficultyRating = 'beginner' | 'easy' | 'medium' | 'hard' | 'impossible'

export interface Action {
  cell: Cell,
  isParent: boolean
}
export type GameStatus = 'idle' | 'playing' | 'paused' | 'solved'

const HOUR = 60 * 60;
const MINUTE = 60;

export const useGameStore = defineStore('gameStore', () => {
  const state = ref<GameStatus>('idle')
  const elapsedSeconds = ref<number>(0);
  const loading = ref(false);
  
  const puzzleId = ref<string>();
  const cells = ref<Cell[]>(createBlankCells());
  const originalCells = ref<Cell[]>(createBlankCells())
  const difficultyRating = ref<DifficultyRating>();
  const difficultyScore = ref<number>(0);

  const usingPencil = ref(false);
  const selectedIdx = ref<number>();

  const history = ref<Action[]>([]);
  const redoActions = ref<Action[]>([])

  const autoCandidateMode = ref<boolean>(false);

  const formattedTime = computed(() => {
    const hours = Math.floor(elapsedSeconds.value / HOUR);
    const mins = Math.floor((elapsedSeconds.value % HOUR) / MINUTE);
    const secs = (elapsedSeconds.value % HOUR) % MINUTE;
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
  const isSolved = computed(() => isPuzzleSolved(cells.value))
  const progressPercent = computed(() => {
    let count = 0;
    cells.value.forEach(each => {
      if(each.value !== 0) {
        count++
      }
    })
    return Math.round((count / 81) * 100)
  })
  
  function $reset() {
    state.value = 'idle'
    elapsedSeconds.value = 0;
    puzzleId.value = undefined;
    cells.value = createBlankCells()
    originalCells.value = createBlankCells()
    difficultyRating.value = undefined
    difficultyScore.value = 0;
    usingPencil.value = false;
    selectedIdx.value = undefined
    history.value = []
    redoActions.value = []
    autoCandidateMode.value = false,
    loading.value = false
  }

  return {
    state,
    loading,
    elapsedSeconds,
    puzzleId,
    cells,
    originalCells,
    difficultyRating,
    difficultyScore,
    usingPencil,
    selectedIdx,
    history,
    redoActions,
    autoCandidateMode,
    formattedTime,
    isSolved,
    progressPercent,
    $reset
  }
})
