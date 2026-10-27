import { describeCustomError } from "#test/helpers/errors";
import { WorkerPoolError } from "@/core/errors/workerpoolError";
import { ErrorType } from "@/core/errors/errorTypes";

describeCustomError({
  ErrorClass: WorkerPoolError,
  statusCode: 500,
  defaultType: ErrorType.INTERNAL_ERROR,
  isOperational: true,
});
