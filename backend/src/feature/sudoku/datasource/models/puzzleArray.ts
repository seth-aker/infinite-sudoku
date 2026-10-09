import { type SudokuPuzzle } from "./sudokuPuzzle.ts";

export interface PuzzleArray {
  metadata: {
    totalCount: number;
    page: number;
    limit: number;
  };
  puzzles: SudokuPuzzle[];
}
