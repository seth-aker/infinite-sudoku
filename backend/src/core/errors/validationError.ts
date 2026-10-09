import { ZodError } from "zod/v4";
import { CustomError, ErrorInit } from "./customError.ts";
import { ErrorType } from "./errorTypes.ts";

export interface FieldIssue {
  path: string;
  message: string;
}

export class ValidationError extends CustomError {
  readonly statusCode = 400;
  protected readonly defaultType: ErrorType = ErrorType.VALIDATION_FAILED;

  constructor(
    public readonly issues: FieldIssue[] = [],
    message = "Request validation failed",
    options?: ErrorInit,
  ) {
    super(message, options);
  }
  static fromZod(error: ZodError): ValidationError {
    return new ValidationError(
      error.issues.map((i) => ({
        path: i.path.join(".") || "(root)",
        message: i.message,
        code: i.code,
      })),
    );
  }

  toResponse(): Record<string, unknown> {
    return {
      error: ErrorType.VALIDATION_FAILED,
      message: this.clientMessage ?? this.message,
      issues: this.issues,
    };
  }
}
