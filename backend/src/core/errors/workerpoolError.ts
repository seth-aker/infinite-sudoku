import { CustomError } from "./customError";
import { ErrorType } from "./errorTypes";

export class WorkerPoolError extends CustomError {
  readonly statusCode: number = 500;
  protected readonly defaultType: ErrorType = ErrorType.INTERNAL_ERROR;
}
