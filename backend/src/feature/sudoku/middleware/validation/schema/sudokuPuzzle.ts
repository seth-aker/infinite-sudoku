import z from "zod/v4";
import { candidateStringSchema } from "./cell.ts";
import { difficultySchema } from "./difficulty.ts";

export const getPuzzleByIdSchema = z.object({
  puzzleId: z.uuid(),
});
export const getPuzzleSchema = z.optional(difficultySchema);

export const createPuzzleSchema = z.object({
  cells: z.string().regex(/^\d{81}$/, "cells string must be 81 digits long"),
  solvedCells: z.string().regex(/^\d{81}$/, "solvedCells string must be 81 digits long"),
  rating: difficultySchema,
  score: z.number().optional(),
})
export const updateUserPuzzleSchema = z.object({
  puzzleId: z.uuid(),
  cells: z
    .string()
    .regex(/^[0-9]{81}$/, {
      message: "Error, cell string must be 81 digits long",
    }),
  candidates: candidateStringSchema,
  isCompleted: z.boolean(),
  actions: z.array(z.int()),
  time: z
    .int()
    .nonnegative({
      message: "Time cannot be a negative integer",
    }),
});

