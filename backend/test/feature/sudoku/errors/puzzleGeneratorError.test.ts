import { describeCustomError } from "#test/helpers/errors";
import { PuzzleGeneratorError } from "@/feature/sudoku/errors/puzzleGeneratorError";
import { ErrorType } from "@/core/errors/errorTypes";

describeCustomError({
  ErrorClass: PuzzleGeneratorError,
  statusCode: 500,
  defaultType: ErrorType.INTERNAL_ERROR,
  isOperational: true,
});
