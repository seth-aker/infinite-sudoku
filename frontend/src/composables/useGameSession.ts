import { useGameStore, type Action, type Cell, type DifficultyRating, type GameStatus } from "@/stores/gameStore"
import { useGameClock } from "./useGameClock"
import { useUserStore } from "@/stores/userStore"
import * as sudokuService from "@/services/sudokuService"
import type { ServiceResult } from "@/services/baseService"
import { cloneCell } from "@/utils/puzzleUtils"

const hasStorage = () => typeof localStorage !== 'undefined'
const SESSION_KEY = 'sudoku.game'
export interface GameSnapshot {
  puzzleId: string | undefined;
  cells: Cell[];
  originalCells: Cell[];
  difficultyRating: DifficultyRating | undefined
  difficultyScore: number
  usingPencil: boolean
  selectedIdx: number | undefined
  history: Action[]
  redoActions: Action[]
  autoCandidateMode: boolean
  elapsedSeconds: number
  state: GameStatus
}

export function useGameSession() {
  const gameStore = useGameStore()
  const userStore = useUserStore()
  const clock = useGameClock()

  function takeSnapshot(): GameSnapshot {
    return {
      puzzleId: gameStore.puzzleId,
      cells: gameStore.cells,
      originalCells: gameStore.originalCells,
      difficultyRating: gameStore.difficultyRating,
      difficultyScore: gameStore.difficultyScore,
      usingPencil: gameStore.usingPencil,
      selectedIdx: gameStore.selectedIdx,
      history: gameStore.history,
      redoActions: gameStore.redoActions,
      autoCandidateMode: gameStore.autoCandidateMode,
      elapsedSeconds: gameStore.elapsedSeconds,
      state: gameStore.state
    }
  }
  function applySnapshot(s: GameSnapshot) {
    gameStore.puzzleId = s.puzzleId,
    gameStore.cells = s.cells,
    gameStore.originalCells = s.originalCells,
    gameStore.difficultyRating = s.difficultyRating,
    gameStore.difficultyScore = s.difficultyScore,
    gameStore.usingPencil = s.usingPencil,
    gameStore.selectedIdx = s.selectedIdx,
    gameStore.history = s.history,
    gameStore.redoActions = s.redoActions,
    gameStore.autoCandidateMode = s.autoCandidateMode,
    gameStore.elapsedSeconds = s.elapsedSeconds,
    gameStore.state = s.state
  }
  function saveLocal() {
    if(!hasStorage()) {
      return
    }
    const snapshot = takeSnapshot()
    localStorage.setItem(SESSION_KEY, JSON.stringify(snapshot))
  }
  function loadLocal() {
    if(!hasStorage()) {
      return
    }
    const raw = localStorage.getItem(SESSION_KEY);
    if(!raw) {
      return
    }
    try {
      const snapshot = JSON.parse(raw);
      applySnapshot(snapshot)
    } catch {
      return;
    }
  }
  function clearLocal() {
    if(!hasStorage()) {
      return
    }
    localStorage.removeItem(SESSION_KEY)
  }

  async function saveToServer(keepAlive?: boolean): Promise<ServiceResult<void>> {
    if(!gameStore.puzzleId || !userStore.isAuthenticated) {
      return {success: false, error: "Nothing to save"}
    }
    return await sudokuService.saveProgress({
      puzzleId: gameStore.puzzleId,
      cells: gameStore.cells,
      history: gameStore.history,
      elapsedSeconds: gameStore.elapsedSeconds,
      isSolved: gameStore.isSolved,
      keepAlive: keepAlive
    })
  }
  async function startNewPuzzle(difficulty: DifficultyRating): Promise<ServiceResult<sudokuService.NewPuzzleResult>> {
    gameStore.loading = true;
    try {
      const {error, body} = await sudokuService.getNewPuzzle(difficulty);
      if(error || !body) {
        return {success: false, error}
      }
      gameStore.$reset()
      gameStore.puzzleId = body.puzzleId,
      gameStore.cells = body.cells.map(cloneCell),
      gameStore.originalCells = body.cells
      gameStore.difficultyRating = body.difficultyRating
      gameStore.difficultyScore = body.difficultyScore
      clock.reset()
      clock.start()
      saveLocal()
      gameStore.loading = false;
      return {success: true, body}
    } catch (err) {
      gameStore.loading = false;
      return {success: false, error: `An unexpected error occured: ${err}`}
    }
  }
  async function resumeSavedPuzzle(puzzleId: string): Promise<ServiceResult<sudokuService.SavedPuzzleResult>> {
    gameStore.loading = true
    try {
      const {error, body} = await sudokuService.getSavedProgress(puzzleId);
      if(error || !body) {
        return {success: false, error}
      }
      gameStore.$reset()
      gameStore.puzzleId = body.puzzleId
      gameStore.elapsedSeconds = body.elapsedSeconds
      gameStore.cells = body.cells
      gameStore.originalCells = body.originalCells
      gameStore.history = body.actions
      gameStore.difficultyRating = body.difficultyRating
      gameStore.difficultyScore = body.difficultyScore
      saveLocal()
      gameStore.loading = false;
      return {success: true, body}
    } catch (err) {
      gameStore.loading = false
      return {success: false, error: `An unexpected error occured: ${err}`}
    }
  } 

  return {
    takeSnapshot,
    loadLocal,
    applySnapshot,
    saveLocal,
    clearLocal,
    saveToServer,
    startNewPuzzle,
    resumeSavedPuzzle
  }
}
