import type { Action } from "./action";
import type { SudokuPuzzle } from "./puzzle";

export interface SudokuStoreState {
  puzzle: SudokuPuzzle,
  puzzleId: string | undefined,
  usingPencil: boolean,
  selectedCell: {
    x: number | undefined,
    y: number | undefined
  },
  actions: Action[],
  redoActions: Action[]
  autoCandidateMode: boolean
}
