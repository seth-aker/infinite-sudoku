import { describeCustomError } from "#test/helpers/errors";
import { GenericError } from "@/core/errors/genericError";
import { ErrorType } from "@/core/errors/errorTypes";

describeCustomError({
  ErrorClass: GenericError,
  statusCode: 500,
  defaultType: ErrorType.INTERNAL_ERROR,
  isOperational: true,
});
