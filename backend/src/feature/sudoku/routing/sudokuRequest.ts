import { Request } from "express";
import { DifficultyRating } from "../datasource/models/difficulty.ts";

export interface QueryOptions {
  difficulty?: DifficultyRating;
}
export interface SudokuRequest extends Request<{}, {}, {}, QueryOptions> {}
