import { type PuzzleArray } from "./models/puzzleArray.ts";
import { type PuzzleOptions } from "./models/puzzleOptions.ts";
import {
  SqlPuzzle,
  type CreatePuzzle,
  type SudokuPuzzleResponse,
  UserPuzzleDto
} from "./models/sudokuPuzzle.ts";

export interface SudokuDataSource {
  getNewPuzzle: (
    requestedBy: string | undefined,
    options: PuzzleOptions,
  ) => Promise<SudokuPuzzleResponse>;
  getPuzzleById: (puzzleId: string) => Promise<SqlPuzzle>;
  getPuzzles: (
    options: PuzzleOptions,
    page?: number,
    limit?: number,
  ) => Promise<PuzzleArray>;
  createPuzzles: (puzzles: CreatePuzzle[]) => Promise<number>;
  getUserPuzzle: (userId: string, puzzleId: string) => Promise<UserPuzzleDto>;
  updateUserPuzzle: (userId: string, puzzle: UserPuzzleDto) => Promise<number>;
  deletePuzzle: (puzzleId: string) => Promise<number>;
}
