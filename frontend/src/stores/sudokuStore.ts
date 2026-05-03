import { defineStore } from "pinia";
import { SudokuPuzzle, type SudokuOptions } from "./models/puzzle";
import sudokuService from "@/services/sudokuService";
import { buildBlankPuzzleRows } from "@/utils/buildPuzzle";
import type { Action } from "@/stores/models/action.d.ts";
import type { Cell } from "./models/cell";
import lodash from 'lodash'
import { cellHasError } from "@/utils/cellHasError";
import { numberWorksInCell } from "@/utils/numberWorksInCell";
import { calcBlockNum } from "@/utils/calcBlockNumber";
import { computed, ref } from "vue";
import type { SudokuStoreState } from "./models/sudokuStoreState";
import { useGameStore } from "./gameStore";
import type { SaveGameOptions } from "./models/gameState";
import { useUserStore } from "./userStore";
const blankPuzzle = new SudokuPuzzle(buildBlankPuzzleRows())
export const useSudokuStore = defineStore('sudokuStore', () => {
  const gameStore = useGameStore()
  const userStore = useUserStore()

  const puzzleId = ref<string | undefined>(undefined)
  const puzzle = ref<SudokuPuzzle>(blankPuzzle);
  const usingPencil = ref(false)
  const selectedCell = ref({
    x: undefined as number | undefined,
    y: undefined as number | undefined,
  })
  const actions = ref<Action[]>([])
  const redoActions = ref<Action[]>([])
  const autoCandidateMode = ref(false)
  const loading = ref<boolean>(false)
  
  function retrieveLocalState() {
    const state = sudokuService.retrieveLocalState();
    if(state !== null) {
      $patch(state)
      return true;
    }
    return false
  }
  function saveGameStateLocal() {
    const state = {
      puzzleId: puzzleId.value,
      puzzle: puzzle.value,
      usingPencil: usingPencil.value,
      selectedCell: selectedCell.value,
      actions: actions.value,
      redoActions: redoActions.value,
      autoCandidateMode: autoCandidateMode.value
    }
    sudokuService.saveGameStateLocally(state)
  }
  function deleteGameStateLocal() {
    sudokuService.deleteGameStateLocally();
  }
  async function getNewPuzzle(options: SudokuOptions) {
    loading.value = true;
    const response = await sudokuService.fetchNewPuzzle(options);
    
    if(response.success && response.body) {
      $patch({
        puzzleId: response.body._id,
        puzzle: response.body.puzzle,
        selectedCell: {
          x: undefined,
          y: undefined
        },
        actions: []
      })
      gameStore.elapsedSeconds = 0;
      gameStore.startTimer()
      saveGameStateLocal();
    }
    loading.value = false;
  }
  async function getUserPuzzle() {
    if(!userStore.currentPuzzleId) {
      return {success: false, message: 'No current puzzle found'}
    }
    const result = await sudokuService.fetchPuzzle(userStore.currentPuzzleId);
    const userPuzzle = result.body
    if(!result.success || !userPuzzle) {
      return result
    }
    puzzleId.value = userPuzzle._id,
    puzzle.value = userPuzzle.puzzle,
    actions.value = userPuzzle.actions
    gameStore.elapsedSeconds = userPuzzle.time
    gameStore.saveElapsedSecondsLocal()
    saveGameStateLocal()
    return result
  }
  async function saveGameState(options: SaveGameOptions = {keepalive: false}) {
    if(!puzzleId.value) {
      return {success: false, message: 'No puzzle to save'}
    }
   return await sudokuService.updatePuzzle(puzzleId.value, puzzle.value, actions.value, gameStore.elapsedSeconds, isPuzzleSolved.value, options)
  }
  function setCell(cell: Cell, x: number, y: number) {
    const prevCell = puzzle.value.getCell(x, y);
    if(!prevCell) {
      throw new Error(`Cell at r${y}c${x} undefined!`)
    }
    actions.value.push({prevCell: lodash.cloneDeep(prevCell), x, y, isParent: true})
    redoActions.value = []
    puzzle.value.setCell(cell, x, y);
    if(!prevCell.value && cell.value) {
      const row = puzzle.value.rows[y];
      const col = puzzle.value.getColumn(x)!;
      const blockNumber = calcBlockNum(y,x, puzzle.value.rows)
      const block = puzzle.value.getBlock(blockNumber)!
      const value = cell.value;
      const seen: number[] = [] // cells that have been seen already
      for(const [idx, cell] of row.entries()) {
        if(idx !== x && cell.candidates.includes(value)) {
          const absIndex = y * 9 + idx; // 0-80 index
          seen.push(absIndex)
          actions.value.push({
            prevCell: lodash.cloneDeep(cell), 
            x: idx,
            y,
            isParent: false
          })
          cell.candidates = cell.candidates.filter((candidate) => candidate !== value);
        }
      }
      for(const [idx, cell] of col.entries()) {
        if(idx !== y && cell.candidates.includes(value)) {
          const absIndex = idx * 9 + x;
          seen.push(absIndex)
          actions.value.push({
            prevCell: lodash.cloneDeep(cell),
            x,
            y: idx,
            isParent: false
          })
          cell.candidates = cell.candidates.filter((candidate) => candidate !== value);
        }
      }
      for(const [idx, cell] of block.entries()) {
        const xOffset = (blockNumber % 3) * 3 
        const yOffset = (Math.floor(blockNumber / 3) * 3)
        const cellX = (xOffset + idx % 3)
        const cellY = (yOffset + (Math.floor(idx / 3)))
        const cellAbsIdx = cellY * 9 + cellX;

        if((cellX !== x && cellY !== y) && !seen.includes(cellAbsIdx) && cell.candidates.includes(value)) {
          actions.value.push({
            prevCell: lodash.cloneDeep(cell),
            x: cellX,
            y: cellY,
            isParent: false
          })
          cell.candidates = cell.candidates.filter((candidate) => candidate !== value);
        }
      }
    }
    saveGameStateLocal();
  }
  function getCell(x:number | undefined, y: number | undefined) {
    const cell = puzzle.value.getCell(x,y)
    return lodash.cloneDeep(cell);
  }
  function undoAction() {
    let lastAction = actions.value.pop();
    while(lastAction && !lastAction.isParent) {
      const prevCell = getCell(lastAction.x, lastAction.y);
      redoActions.value.push({
        prevCell: prevCell!, 
        x: lastAction.x, 
        y: lastAction.y, 
        isParent: false
      })
      puzzle.value.setCell(lastAction.prevCell, lastAction.x, lastAction.y);
      lastAction = actions.value.pop()
    }
    if(lastAction) {
      const prevCell = getCell(lastAction.x, lastAction.y);
      redoActions.value.push({
        prevCell: prevCell!, 
        x: lastAction.x, 
        y: lastAction.y, 
        isParent: true
      })
      puzzle.value.setCell(lastAction.prevCell, lastAction.x, lastAction.y)
      selectedCell.value = { x: lastAction.x, y: lastAction.y}
    }
    saveGameStateLocal()
  }
  function redoAction() {
    let lastAction = redoActions.value.pop()
    if(lastAction) {
      const prevCell = getCell(lastAction.x, lastAction.y);
      puzzle.value.setCell(lastAction.prevCell, lastAction.x, lastAction.y);
      actions.value.push({
        prevCell: prevCell!, 
        x: lastAction.x, 
        y: lastAction.y, 
        isParent: true
      });
      selectedCell.value = { x: lastAction.x, y: lastAction.y };
      lastAction = redoActions.value.pop()
    }
    while (lastAction && !lastAction.isParent) {
      const prevCell = getCell(lastAction.x, lastAction.y);
      puzzle.value.setCell(lastAction.prevCell, lastAction.x, lastAction.y)
      actions.value.push({
        prevCell: prevCell!, 
        x: lastAction.x,
        y: lastAction.y,
        isParent: false
      })
      lastAction = redoActions.value.pop()

    }
    if(lastAction) {
      redoActions.value.push(lastAction)
    }
    saveGameStateLocal()
  }
  function resetPuzzle() {
    puzzle.value.rows = puzzle.value.originalPuzzle;
    actions.value = []
    redoActions.value = []
    selectedCell.value = {x: undefined, y: undefined}
    saveGameStateLocal();
  }
  function fillPuzzleCandidates() {
    for(let candidate = 1; candidate <= puzzle.value.cellsPerRow; candidate++) {
      for(let rowIndex = 0; rowIndex < puzzle.value.rows.length; rowIndex++) {
        for(let colIndex = 0; colIndex < puzzle.value.rows.length; colIndex++) {
          const cell = puzzle.value.rows[rowIndex][colIndex];
          if(cell.value) {
            continue;
          }
          if(numberWorksInCell(rowIndex, colIndex, candidate, puzzle.value) && !cell.candidates.includes(candidate)) {
            cell.candidates.push(candidate);
          }
        }
      }
    }
  }
  function clearPuzzleCandidates() {
    for(const row of puzzle.value.rows) {
      for(const cell of row) {
        cell.candidates = []
      }
    }
  }
  function $patch(state: Partial<SudokuStoreState>) {
    if(state.puzzleId) puzzleId.value = state.puzzleId
    if(state.puzzle) puzzle.value = state.puzzle
    if(state.usingPencil !== undefined) usingPencil.value = state.usingPencil 
    if(state.autoCandidateMode !== undefined) autoCandidateMode.value = state.autoCandidateMode
    if(state.actions) actions.value = state.actions
    if(state.selectedCell) selectedCell.value = state.selectedCell
  }

  function $reset() {
    puzzleId.value = undefined,
    puzzle.value = new SudokuPuzzle(buildBlankPuzzleRows())
    actions.value = []
    selectedCell.value = {x: undefined, y: undefined}
    usingPencil.value = false,
    autoCandidateMode.value = false
  }
  const isPuzzleSolved = computed(() => {
    if(puzzle.value.rows.some((row) => row.some((cell) => cell.value === undefined))) {
      return false;
    }
    let hasError = false;
    for(let rowIndex = 0; rowIndex < puzzle.value.cellsPerRow; rowIndex++) {
      for(let columnIndex = 0; columnIndex < puzzle.value.cellsPerRow; columnIndex++) {
        hasError = cellHasError(puzzle.value, columnIndex, rowIndex)
        if(hasError) {
          console.log(`Error found at x:${columnIndex}, y:${rowIndex}`)
          return false
        }
      }
    }
    return true;
  })
  return {
    puzzleId, 
    puzzle, 
    actions, 
    redoActions,
    selectedCell, 
    usingPencil, 
    autoCandidateMode, 
    retrieveLocalState, 
    saveGameState, 
    saveGameStateLocal, 
    deleteGameStateLocal, 
    getNewPuzzle, 
    getUserPuzzle,
    setCell, 
    getCell, 
    undoAction, 
    redoAction,
    resetPuzzle, 
    fillPuzzleCandidates, 
    clearPuzzleCandidates, 
    $patch, 
    $reset, 
    loading, 
    isPuzzleSolved 
  }
})
