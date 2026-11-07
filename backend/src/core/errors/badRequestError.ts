import { CustomError, ErrorInit } from "./customError";
import { ErrorType } from "./errorTypes";

export class BadRequestError extends CustomError {
  protected readonly defaultType: ErrorType = ErrorType.BAD_REQUEST;
  readonly statusCode: number;
  constructor(
    message: string,
    statusCode: number = 400,
    options?: ErrorInit,
  ) {
    super(message, options);
    this.statusCode = statusCode;
  }
}
