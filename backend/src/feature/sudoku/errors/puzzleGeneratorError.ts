import { CustomError } from "@/core/errors/customError";
import { ErrorType } from "@/core/errors/errorTypes";

export class PuzzleGeneratorError extends CustomError {
  readonly statusCode: number = 500;
  protected readonly defaultType: ErrorType = ErrorType.INTERNAL_ERROR;
}
