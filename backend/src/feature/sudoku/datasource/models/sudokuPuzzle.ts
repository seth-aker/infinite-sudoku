// import { ObjectId } from "mongodb";
import { DifficultyRating } from "./difficulty.ts";

export interface SudokuPuzzle {
  puzzleId: string;
  cells: string;
  candidates?: string;
  score?: number;
  rating: DifficultyRating;
}

export interface CreatePuzzle {
  cells: string;
  candidates?: string;
  score?: number;
  rating: DifficultyRating;
  solvedCells: string;
}

export interface SudokuPuzzleResponse {
  metadata: {
    totalCount: number;
  };
  puzzle: SudokuPuzzle;
}

export interface SqlPuzzle {
  puzzle_id: string;
  cells: string;
  difficulty_rating: DifficultyRating;
  difficulty_score: number;
  solved_cells: string;
}

export interface UserPuzzleDto {
  puzzleId: string;
  isCompleted: boolean;
  cells: string;
  candidates: string;
  time: number;
  originalCells?: string;
  score?: number;
  rating?: DifficultyRating;
  actions: number[];
}
