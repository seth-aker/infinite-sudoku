import { type PuzzleArray } from "./models/puzzleArray.ts";
import { type PuzzleOptions} from "./models/puzzleOptions.ts";
import { SqlPuzzle, SqlUserPuzzle, type CreatePuzzle, type SudokuPuzzleResponse, type UpdatePuzzle } from "./models/sudokuPuzzle.ts";

export interface SudokuDataSource {
    getNewPuzzle: (requestedBy: string | undefined, options: PuzzleOptions) => Promise<SudokuPuzzleResponse>;
    getPuzzleById: (puzzleId: string) => Promise<SqlPuzzle>;
    getPuzzles: (options: PuzzleOptions, page?: number, limit?: number) => Promise<PuzzleArray>;
    createPuzzles: (puzzles: CreatePuzzle[]) => Promise<number>;
    getUserPuzzle: (userId: string, puzzleId: string) => Promise<SqlUserPuzzle>;
    updateUserPuzzle: (userId: string, puzzle: UpdatePuzzle) => Promise<number>;
    deletePuzzle: (puzzleId: string) => Promise<number>;
}
