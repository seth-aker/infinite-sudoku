import { CustomError } from "./customError";
import { ErrorType } from "./errorTypes";

export class BadRequestError extends CustomError {
  readonly statusCode: number = 400;
  protected readonly defaultType: ErrorType = ErrorType.BAD_REQUEST;
}
