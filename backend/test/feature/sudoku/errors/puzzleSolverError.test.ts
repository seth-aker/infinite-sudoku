import { describeCustomError } from "#test/helpers/errors";
import { PuzzleSolverError } from "@/feature/sudoku/errors/puzzleSolverError";
import { ErrorType } from "@/core/errors/errorTypes";

describeCustomError({
  ErrorClass: PuzzleSolverError,
  statusCode: 500,
  defaultType: ErrorType.INTERNAL_ERROR,
  isOperational: true,
});
