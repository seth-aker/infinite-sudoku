import type { Cell } from "@/stores/gameStore";

export const PEERS = generatePeers()

export function isPuzzleSolved(cells: Cell[]) {
  if(!cells || cells.length !== 81) return false
  for(let i = 0; i < 81; i++) {
    if(!cells[i] || cells[i].value === 0) {
      return false
    }
    if(cellHasError(cells, i)) {
      return false;
    }
  }
  return true;
}

export function getPeers(cells: Cell[], idx: number) {
  const peers: Cell[] = []
  for(const peer of PEERS[idx]) {
    peers.push(cells[peer])
  }
  return peers;
}

export function cellHasError(cells: Cell[], idx: number) {
  if(cells[idx].value === 0) return false;
  const peers = getPeers(cells, idx);
  return peers.some(each => each.value === cells[idx].value)
}

export function getRow(cells: Cell[], rowIdx: number) {
  const row: Cell[] = [];
  const offset = rowIdx * 9;
  for(let i = 0; i < 9; i++) {
    row.push(cells[offset + i])
  } 
  return row;
}
export function getCol(cells: Cell[], colIdx: number) {
  const col: Cell[] = []
  for(let i = 0; i < 9; i++) {
    col.push(cells[i * 9 + colIdx])
  }
  return col;
}
export function getBlock(cells: Cell[], blockIdx: number) {
  const block: Cell[] = []
  for(let i = 0; i < 9; i++) {
    const rowOffset = Math.floor(blockIdx / 3) * 9;
    const colOffset = (blockIdx % 3) * 3
    const blockRowOffset = Math.floor(i / 3) * 9
    const blockCol = i % 3;
    const cellIdx = rowOffset + colOffset + blockRowOffset + blockCol
    block.push(cells[cellIdx])
  }
  return block
} 

export function createBlankCells(): Cell[] {
  const cells:Cell[] = []
  for(let idx = 0; idx < 81; idx++ ) {
    cells.push({value: 0, candidates: [], idx})
  }
  return cells;
}

export function cloneCell(cell: Cell): Cell {
  return {
    idx: cell.idx,
    value: cell.value,
    candidates: cell.candidates.slice()
  }
}

function idxToBlock(idx: number) {
  const row = Math.floor(idx / 9)
  const col = idx % 9
  return (Math.floor(row / 3) * 3) + Math.floor(col / 3)
}

function generatePeers(): readonly (readonly number[])[] {
  const peers: number[][] = [];
  for(let i = 0; i < 81; i++) {
    const others = new Set<number>();
    const row = Math.floor(i / 9);
    const col = i % 9
    const block = idxToBlock(i);
    for(let o = 0; o < 81; o++) {
      if(o === i) continue;
      const otherRow = Math.floor(o / 9)
      const otherCol = o % 9;
      const otherBlock = idxToBlock(o);
      if(row === otherRow || col === otherCol || block === otherBlock) {
        others.add(o);
      }
    }
    peers.push([...others])
  } 
  return peers;
}
