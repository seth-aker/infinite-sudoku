// import { ObjectId } from "mongodb";
import { DifficultyRating, type Difficulty } from "./difficulty.ts";

export interface SudokuPuzzle {
  puzzleId: string,
  cells: string;
  candidates?: string
  difficulty: Difficulty,
}

export interface CreatePuzzle {
  cells: string;
  candidates?: string
  difficulty: Difficulty,
  solvedCells: string;
}

export interface UpdatePuzzle {
  puzzleId: string,
  cells: string,
  candidates: string,
  time: number,
  actions: number[]
  isCompleted: boolean
}

export interface SudokuPuzzleResponse {
  metadata: {
    totalCount: number
  },
  puzzle: SudokuPuzzle
}

export interface SqlPuzzle {
  puzzle_id: string,
  cells: string,
  difficulty_rating: DifficultyRating,
  difficulty_score: number,
  solved_cells: string,
}
export interface SqlUserPuzzle {
  puzzle_id: string,
  is_completed: boolean,
  current_cells: string,
  current_candidates: string,
  time: number,
  original_cells: string,
  difficulty_rating: DifficultyRating,
  difficulty_score: number
  actions: number[]
}

export interface UserPuzzleDto {
  puzzleId: string,
  isCompleted: boolean,
  currentCells: string,
  currentCandidates: string, 
  time: number,
  originalCells: string,
  difficulty: Difficulty,
  actions: number[]
}
