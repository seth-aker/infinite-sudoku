import { describeCustomError } from "#test/helpers/errors";
import { ConflictError } from "@/core/errors/conflictError";
import { ErrorType } from "@/core/errors/errorTypes";

describeCustomError({
  ErrorClass: ConflictError,
  statusCode: 409,
  defaultType: ErrorType.RESOURCE_CONFLICT,
  isOperational: true,
});
