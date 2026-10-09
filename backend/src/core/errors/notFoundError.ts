import { CustomError } from "./customError.ts";
import { ErrorType } from "./errorTypes.ts";

export class NotFoundError extends CustomError {
  readonly statusCode = 404;
  protected readonly defaultType: ErrorType = ErrorType.RESOURCE_NOT_FOUND;
}
