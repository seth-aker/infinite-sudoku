import type { Action, Cell } from "@/stores/gameStore"
export interface SerializedCells {
  cells: string,
  candidates?: string
}
export function serializeCells(cells: Cell[]): SerializedCells {
  const serialized = {
    cells: '',
    candidates: ''
  }
  cells.forEach((cell) => {
    serialized.cells += `${cell.value}`
    serialized.candidates += `${cell.candidates.join('')}:`
  })
  serialized.candidates = serialized.candidates.substring(0, serialized.candidates.length - 1)
  return serialized;
}
export function serializeAction(action: Action) {
  const isParentBit = action.isParent ? 1 : 0;
  const candidateMask = action.cell.candidates.reduce((prev, cur) => {
    const mask = prev | (1 << (cur - 1))
    return mask;
  }, 0)
  const cellValue = action.cell.value || 0;

  // bitmask, 7 bits for cell index, 4 bits for cell value, 9 bits for candiates
  return (isParentBit << 20) | (candidateMask << 11 ) | (cellValue << 7) | (action.cell.idx)
}

export function deserializeCells(serialized: SerializedCells) {
  const cellVals: number[] = serialized.cells.split('').map(valStr => {
    const num = Number.parseInt(valStr)
    if(Number.isNaN(num)) {
      return -1
    }
    return num;
  })
  const candidates: number[][] | undefined = serialized.candidates?.split(':').map(candidateStr => {
    const cands = candidateStr.split('').map(valStr => {
      const num = Number.parseInt(valStr)
      if(Number.isNaN(num)) {
        return -1
      }
      return num
    })
    return cands
  })
  const cells: Cell[] = cellVals.map((value, idx) => {
    return {
      value,
      idx,
      candidates: candidates ? candidates[idx] : []
    }
  })
  return cells
}
export function deserializeAction(serialized: number): Action{
  const index = serialized & 0b1111111 // for bits 0-7
  const cellValue = (serialized >> 7) & 0b1111; // for bits 8-11
  let candidateMask = (serialized >> 11) & 0b111111111; // for bits 12-20
  const isParentBit = (serialized >> 20) & 1;

  const candidates: number[] = []
  while(candidateMask != 0) {
    const candidate = ctz(candidateMask) + 1;
    candidates.push(candidate)
    candidateMask &= candidateMask - 1
  }
  return {
    isParent: isParentBit === 1,
    cell: {
      value: cellValue,
      candidates,
      idx: index
    }
  }
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
