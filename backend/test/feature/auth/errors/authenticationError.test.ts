import { describeCustomError } from "#test/helpers/errors";
import { AuthenticationError } from "@/feature/auth/errors/authenticationError";
import { ErrorType } from "@/core/errors/errorTypes";

describeCustomError({
  ErrorClass: AuthenticationError,
  statusCode: 401,
  defaultType: ErrorType.INVALID_CREDENTIALS,
  isOperational: true,
});
