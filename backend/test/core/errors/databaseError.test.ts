import { describeCustomError } from "#test/helpers/errors";
import { DatabaseError } from "@/core/errors/databaseError";
import { ErrorType } from "@/core/errors/errorTypes";

describeCustomError({
  ErrorClass: DatabaseError,
  statusCode: 500,
  defaultType: ErrorType.INTERNAL_ERROR,
  isOperational: false,
});
