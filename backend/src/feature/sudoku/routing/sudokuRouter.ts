import express, { NextFunction, Request, Response } from "express";
import { SudokuService } from "../service/sudokuService.ts";
import { SudokuRequest } from "./sudokuRequest.ts";
import { type PuzzleOptions } from "../datasource/models/puzzleOptions.ts";
import { DatabaseError } from "@/core/errors/databaseError.ts";
import {
  getPuzzleByIdValidator,
  getPuzzleValidator,
  updatePuzzleValidator,
} from "../middleware/validation/validation.ts";
import { requireLoggedin } from "@/feature/auth/middleware/authentication.ts";
import { UserPuzzleDto } from "../datasource/models/sudokuPuzzle.ts";

export default function SudokuRouter(sudokuService: SudokuService) {
  const router = express.Router();
  // /api/sudoku
  router.get(
    "/new",
    getPuzzleValidator,
    async (req: SudokuRequest, res: Response, next: NextFunction) => {
      const requestedBy = req.user?.sub;
      const puzzleOptions: PuzzleOptions = {
        difficulty: req.query.difficulty ?? "easy",
      };
      try {
        const puzzle = await sudokuService.getNewPuzzle(
          requestedBy,
          puzzleOptions,
        );
        res.json(puzzle);
      } catch (err) {
        next(err);
      }
    },
  );

  router.get(
    "/:puzzleId",
    requireLoggedin,
    getPuzzleByIdValidator,
    async (
      req: Request<{ puzzleId: string }>,
      res: Response,
      next: NextFunction,
    ) => {
      try {
        const puzzleId = req.params.puzzleId;
        const userId = req.user?.sub!;
        const puzzle = await sudokuService.getUserPuzzle(userId, puzzleId);
        res.json(puzzle);
      } catch (err) {
        next(err);
      }
    },
  );
  // router.post('/', createPuzzleValidator, async (req: Request, res: Response, next: NextFunction) => {
  //   try {
  //     const puzzle = req.body;
  //     const result = await sudokuService.createPuzzle(puzzle);
  //     res.status(201).send(result);
  //   } catch (err) {
  //     next(err)
  //   }
  // })
  router.put(
    "/:puzzleId",
    requireLoggedin,
    updatePuzzleValidator,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.user?.sub!;
        const updateUserPuzzleDto = req.body as UserPuzzleDto;
        const result = await sudokuService.updateUserPuzzle(
          userId,
          updateUserPuzzleDto,
        );
        if (result !== 1) {
          throw new DatabaseError(
            `Expected to update 1, instead updated: ${result}`,
          );
        }
        res.sendStatus(204)
      } catch (err) {
        next(err);
      }
    },
  );
  // router.delete('/:puzzleId', deletePuzzleValidator, async (req: Request, res: Response, next: NextFunction) => {
  //   try {
  //     const puzzleId = req.params.puzzleId;
  //     const result = await sudokuService.deletePuzzle(puzzleId);
  //     if(result !== 1) {
  //       throw new DatabaseError(`Expected to delete 1, instead deleted: ${result}`)
  //     }
  //     res.sendStatus(201)
  //   } catch (err) {
  //     next(err)
  //   }
  // })

  return router;
}
