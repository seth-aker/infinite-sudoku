import { describeCustomError } from "#test/helpers/errors";
import { AuthorizationError } from "@/feature/auth/errors/authorizationError";
import { ErrorType } from "@/core/errors/errorTypes";

describeCustomError({
  ErrorClass: AuthorizationError,
  statusCode: 403,
  defaultType: ErrorType.INSUFFICIENT_ROLE,
  isOperational: true,
});
