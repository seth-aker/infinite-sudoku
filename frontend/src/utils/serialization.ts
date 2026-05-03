import type { Row } from "@/stores/models/row";
import { buildBlankPuzzleRows } from "./buildPuzzle";
import type { SudokuPuzzle } from "@/stores/models/puzzle";
import type { Cell } from "@/stores/models/cell";
import type { Action } from "@/stores/models/action";

export function deserializeCells(originalCellsStr: string, currentCellsStr?: string, candidatesStr?: string): Row[] {
  const originalCells: number[] = originalCellsStr.split('').map(val => {
    const num = Number.parseInt(val)
    if(Number.isNaN(num)) {
      return -1;
    }
    return num;
  })
  const currentCells: number[] | undefined = currentCellsStr?.split('').map((val) => {
    const num = Number.parseInt(val)
    if(Number.isNaN(num)) {
      return -1;
    }
    return num;
  })
  const candidates: number[][] | undefined = candidatesStr?.split(':').map(cellCandidates => {
    const cands = cellCandidates.split('').map(val => {
      const num = Number.parseInt(val)
      if(Number.isNaN(num)) {
        return -1;
      }
      return num;
    })
    return cands
  })
  const rows = buildBlankPuzzleRows();
  rows.forEach((row, rowIdx) => {
    row.forEach((cell, colIdx) => {
      const index = rowIdx * 9 + colIdx
      const originalVal: number = originalCells[index];
      const currentVal = currentCells ? currentCells[index] : originalVal;
      cell.value = currentVal !== 0 ? currentVal : undefined;
      if(originalVal !== 0) {
        cell.type = 'prefilled'
      } else {
        cell.type = currentVal === 0 ? 'blank' : 'edited'
      }
      cell.candidates = candidates ? candidates[index] : []
    })
  })
  return rows
}

export function serializePuzzle(id: string, puzzle: SudokuPuzzle) {
  let cellStr = '';
  let candidateStr = ''
  puzzle.rows.forEach((row) => {
    row.forEach((cell) => {
      cellStr += cell.value ?? '0'
      candidateStr += cell.candidates.join('') + ':'
    })
  })
  // remove the last :
  candidateStr = candidateStr.substring(0, candidateStr.length - 1);
  const dto = {
    _id: id,
    cells: cellStr,
    candidates: candidateStr,
    difficulty: puzzle.options.difficulty
  }
  return dto
}

export function serializeCell(cell: Cell) {
  const candidateMask = cell.candidates.reduce((prev, cur) => {
    const mask = prev | (1 << (cur - 1))
    return mask;
  }, 0)
  const cellValue = cell.value || 0;
  const [_, x, y] = cell.cellId.split('').map(val => Number.parseInt(val))
  const index = (y * 9) + x;
  const cellTypeVal = cell.type === 'blank' ? 0 : cell.type === 'edited' ? 1 : 2
  // bitmask, 7 bits for cell index, 4 bits for cell value, 9 bits for candiates and 2 for the type
  return (cellTypeVal << 20) |(candidateMask << 11 ) | (cellValue << 7) | (index)
}
export function deserializeCell(cellNum: number) {
  const index = cellNum & 0b1111111 // for bits 0-7
  const cellValue = (cellNum >> 7) & 0b1111; // for bits 8-11
  let candidateMask = (cellNum >> 11) & 0b111111111; // for bits 12-20
  const cellTypeVal = (cellNum >> 20) & 0b11 // for bits 21-22

  const candidates: number[] = [];
  while(candidateMask != 0) {
    const candidate = ctz(candidateMask) + 1;
    candidateMask = candidateMask & (candidateMask - 1);
    candidates.push(candidate)
  }
  const cell: Cell = {
    value: cellValue === 0 ? undefined : cellValue,
    candidates,
    cellId: `C${index % 9}${Math.floor(index / 9)}`,
    type: cellTypeVal === 0 ? 'blank' : cellTypeVal === 1 ? 'edited' : 'prefilled'
  }
  return cell;
}

export function serializeAction(action: Action) {
  const isParentBit = action.isParent ? 1 : 0;
  const serializedCell = (isParentBit << 22) | (serializeCell(action.prevCell))
  return serializedCell;
}

export function deserializeAction(num: number) {
  const isParentBit = (num >> 22) & 1;
  const cell = deserializeCell(num);
  const [_, x, y] = cell.cellId.split('').map(val => Number.parseInt(val))
  const action: Action = {
    x,
    y,
    prevCell: cell,
    isParent: isParentBit === 1 ? true : false
  }
  return action;
}

function ctz(num: number) {
  if(num === 0) return 32;
  let count = 0;
  while((num & 1) === 0) {
    count++;
    num >>= 1
  }
  return count;
}
