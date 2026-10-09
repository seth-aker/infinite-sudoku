import { CustomError } from "@/core/errors/customError";
import { ErrorType } from "@/core/errors/errorTypes";

export class AuthenticationError extends CustomError {
  readonly statusCode: number = 401;
  protected readonly defaultType = ErrorType.INVALID_CREDENTIALS;
}
