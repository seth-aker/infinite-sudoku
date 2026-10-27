import { describeCustomError } from "#test/helpers/errors";
import { BadRequestError } from "@/core/errors/badRequestError";
import { ErrorType } from "@/core/errors/errorTypes";

describeCustomError({
  ErrorClass: BadRequestError,
  statusCode: 400,
  defaultType: ErrorType.BAD_REQUEST,
  isOperational: true,
});
