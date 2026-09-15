import { CustomError } from "./customError";
import { ErrorType } from "./errorTypes";

export class ConflictError extends CustomError {
  readonly statusCode: number = 409;
  protected readonly defaultType: ErrorType = ErrorType.RESOURCE_CONFLICT;
}
