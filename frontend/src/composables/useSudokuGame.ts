import { useGameStore, type Cell } from "@/stores/gameStore";
import { cloneCell, getPeers } from "@/utils/puzzleUtils";
import { useGameSession } from "./useGameSession";
export function useSudokuGame() {
  const gameStore = useGameStore()
  const {saveLocal, clearLocal} = useGameSession()
  
  function selectCell(idx: number) {
    gameStore.selectedIdx = idx;
  }
  function getRow(rowIdx: number) {
    const startIdx = rowIdx * 9;
    const row: Cell[] = []
    for(let i = startIdx; i < startIdx + 9; i++) {
      row.push(gameStore.cells[i])
    }
    return row;
  }
  function getCol(colIdx: number) {
    const col: Cell[] = []
    for(let i = 0; i < 9; i++) {
      const idx = i * 9 + colIdx;
      col.push(gameStore.cells[idx])
    }
    return col;
  }
  function togglePencil() {
    gameStore.usingPencil = !gameStore.usingPencil
  }
  function placeValue(value: number, idx: number) {
    if(value < 0 || value > 9 || idx < 0 || idx > 81) {
      return;
    }
    if(gameStore.originalCells[idx].value !== 0) {
      return;
    }
    const prevCell = cloneCell(gameStore.cells[idx])
    gameStore.history.push({
      cell: prevCell,
      isParent: true
    })
    gameStore.redoActions = []
    gameStore.cells[idx].value = value;
    if(prevCell.value === 0 && value !== 0) {
      const peers = getPeers(gameStore.cells, idx);
      peers.forEach((cell) => {
        if(cell.idx !== idx && cell.candidates.includes(value)) {
          gameStore.history.push({
            cell: cloneCell(cell),
            isParent: false
          })
          cell.candidates = cell.candidates.filter((candidate) => candidate !== value)
        }
      })
    }
    saveLocal()
  }

  function clearCell(idx: number) {
    if(gameStore.originalCells[idx].value !== 0) {
      return;
    }
    const prevCell = cloneCell(gameStore.cells[idx])
    gameStore.history.push({
      cell: prevCell,
      isParent: true
    })
    gameStore.redoActions = []
    if(gameStore.usingPencil) {
      gameStore.cells[idx].candidates = []
    } else {
      gameStore.cells[idx].value = 0
    }
    saveLocal()
  }


  function toggleCandidate(value: number, idx: number) {
    if(gameStore.originalCells[idx].value !== 0) {
      return;
    }
    const prevCell = cloneCell(gameStore.cells[idx])
    gameStore.history.push({
      cell: prevCell,
      isParent: true
    })
    gameStore.redoActions = []
    const cell = gameStore.cells[idx];
    if(!prevCell.candidates.includes(value)) {
      cell.candidates.push(value)
    } else {
      cell.candidates = cell.candidates.filter(c => c !== value)
    }
    saveLocal()
  }

  function undo() {
    let action = gameStore.history.pop()
    while(action && !action.isParent) {
      const prevCell = cloneCell(gameStore.cells[action.cell.idx])
      gameStore.redoActions.push({
        cell: prevCell,
        isParent: false
      })
      gameStore.cells[action.cell.idx] = action.cell
      action = gameStore.history.pop()
    }
    if(action) {
      const prevCell = cloneCell(gameStore.cells[action.cell.idx])
      gameStore.redoActions.push({
        cell: prevCell,
        isParent: true
      })
      gameStore.cells[action.cell.idx] = action.cell;
      gameStore.selectedIdx = action.cell.idx;
    }
    saveLocal()
  }
  function redo() {
    let action = gameStore.redoActions.pop()
    if(action) {
      const prevCell = cloneCell(gameStore.cells[action.cell.idx])
      gameStore.cells[action.cell.idx] = action.cell;
      gameStore.history.push({
        cell: prevCell,
        isParent: true
      })
      gameStore.selectedIdx = action.cell.idx;
      action = gameStore.redoActions.pop()
    }
    while(action && !action.isParent) {
      const prevCell = cloneCell(gameStore.cells[action.cell.idx])
      gameStore.cells[action.cell.idx] = action.cell;
      gameStore.history.push({
        cell: prevCell,
        isParent: false
      })
      action = gameStore.redoActions.pop()
    }
    if(action) {
      gameStore.redoActions.push(action)
    }
    saveLocal()
  }
  function fillCandidates() {
    for(let i = 0; i < 81; i++) {
      if(gameStore.cells[i].value !== 0) {
        continue
      }
      for(let c = 1; c <= 9; c++) {
        const peers = getPeers(gameStore.cells, i);
        if(!peers.some(cell => cell.value === c) && !gameStore.cells[i].candidates.includes(c)) {
          gameStore.cells[i].candidates.push(c);
        }
      }
    }
  }

  function clearCandidates() {
    gameStore.cells.forEach(cell => cell.candidates = [])
  }

  function setAutoCandidateMode(on: boolean) {
    gameStore.autoCandidateMode = on;
    if(on) {
      fillCandidates()
    } else {
      clearCandidates()
    }
    saveLocal()
  }

  function resetBoard() {
    clearLocal()
    gameStore.cells = gameStore.originalCells.slice()
    gameStore.selectedIdx = undefined;
    saveLocal()
  }

  return {
    selectCell,
    getRow,
    getCol,
    togglePencil,
    placeValue,
    clearCell,
    toggleCandidate,
    undo,
    redo,
    fillCandidates,
    clearCandidates,
    setAutoCandidateMode,
    resetBoard
  }

}
