// import { ObjectId } from "mongodb";
import { type Difficulty } from "./difficulty.ts";

export interface SudokuPuzzle {
  _id: string,
  cells: number[];
  difficulty: Difficulty,
}

export interface CreatePuzzle extends Omit<SudokuPuzzle, '_id' | 'cells'> {
  cells: string,
}

export interface UpdatePuzzle extends Partial<SudokuPuzzle> {}

export interface SudokuPuzzleResponse {
  metadata: {
    totalCount: number
  },
  puzzle: SudokuPuzzle
}
