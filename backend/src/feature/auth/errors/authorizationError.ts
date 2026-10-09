import { CustomError } from "@/core/errors/customError";
import { ErrorType } from "@/core/errors/errorTypes";

export class AuthorizationError extends CustomError {
  readonly statusCode: number = 403;
  protected readonly defaultType: ErrorType = ErrorType.INSUFFICIENT_ROLE;
}
