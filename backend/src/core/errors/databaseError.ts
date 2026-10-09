import { CustomError } from "./customError.ts";
import { ErrorType } from "./errorTypes.ts";

export class DatabaseError extends CustomError {
  readonly statusCode = 500;
  readonly isOperational: boolean = false;
  protected readonly defaultType: ErrorType = ErrorType.INTERNAL_ERROR;
}
