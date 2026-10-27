import { describeCustomError } from "#test/helpers/errors";
import { NotFoundError } from "@/core/errors/notFoundError";
import { ErrorType } from "@/core/errors/errorTypes";

describeCustomError({
  ErrorClass: NotFoundError,
  statusCode: 404,
  defaultType: ErrorType.RESOURCE_NOT_FOUND,
  isOperational: true,
});
