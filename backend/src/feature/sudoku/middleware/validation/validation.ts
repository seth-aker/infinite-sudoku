import { NextFunction, Request, Response } from "express";
import { ValidationError } from "../../../../core/errors/validationError.ts";
import {
  getPuzzleByIdSchema,
  getPuzzleSchema,
  updateUserPuzzleSchema,
} from "./schema/sudokuPuzzle.ts";
import { SudokuRequest } from "../../routing/sudokuRequest.ts";

export const getPuzzleValidator = (
  req: SudokuRequest,
  _res: Response,
  next: NextFunction,
) => {
  const validationResult = getPuzzleSchema.safeParse(req.query.difficulty);
  if (!validationResult.success) {
    throw ValidationError.fromZod(validationResult.error);
  }
  next();
};
export const getPuzzleByIdValidator = (
  req: Request<{ puzzleId: string }>,
  _res: Response,
  next: NextFunction,
) => {
  const validationResult = getPuzzleByIdSchema.safeParse(req.params);
  if (!validationResult.success) {
    throw ValidationError.fromZod(validationResult.error);
  }
  next();
};
export const updatePuzzleValidator = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const validationResult = updateUserPuzzleSchema.safeParse(req.body);
  if (!validationResult.success) {
    throw ValidationError.fromZod(validationResult.error);
  }
  next();
};

