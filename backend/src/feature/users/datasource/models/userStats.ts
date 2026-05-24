import { DifficultyRating } from "@/feature/sudoku/datasource/models/difficulty"

export type IUserStats = IDifficultyStats[]

export interface IDifficultyStats {
  rating: DifficultyRating,
  avgScore: number,
  totalStarted: number,
  completed: number,
  avgTimeSec: number,
  totalTimeSec: number,
} 

