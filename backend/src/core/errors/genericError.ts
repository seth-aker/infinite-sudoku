import { CustomError } from "./customError.ts";
import { ErrorType } from "./errorTypes.ts";

export class GenericError extends CustomError {
  readonly statusCode = 500;
  protected readonly defaultType: ErrorType = ErrorType.INTERNAL_ERROR;
}
