import { PuzzleArray } from "../datasource/models/puzzleArray";
import { type PuzzleOptions} from "../datasource/models/puzzleOptions";
import { SudokuPuzzle, CreatePuzzle, UpdatePuzzle, UserPuzzleDto } from "../datasource/models/sudokuPuzzle";

export interface SudokuService {
  getNewPuzzle: (requestedBy: string | undefined, options: PuzzleOptions) => Promise<SudokuPuzzle>;
  getPuzzles: (options: PuzzleOptions, page?: number, limit?: number) => Promise<PuzzleArray>;
  // getPuzzle: (puzzleId: string) => Promise<SudokuPuzzle>
  createPuzzles: (puzzles: CreatePuzzle[]) => Promise<number>;
  getUserPuzzle: (userId: string, puzzleId: string) => Promise<UserPuzzleDto>
  updateUserPuzzle: (userId: string, puzzle: UpdatePuzzle) => Promise<number>;
  deletePuzzle: (puzzleId: string) => Promise<number>;
}
