import type { Cell } from "@/stores/models/cell"

export interface Action {
  prevCell: Cell,
  x: number,
  y: number,
  isParent: boolean
}
