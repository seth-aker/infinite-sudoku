import postgres from "postgres";
import { ZodError } from "zod/v4";
import { CustomError } from "@/core/errors/customError.ts";
import { ValidationError } from "@/core/errors/validationError.ts";
import { GenericError } from "@/core/errors/genericError.ts";
import { ConflictError } from "../errors/conflictError";
import { ErrorType } from "../errors/errorTypes";
import { DatabaseError } from "../errors/databaseError";
import type { ErrorRequestHandler } from "express";
import { config } from "@/core/config/index.ts";
import { logger } from "../logging/logger";
import { BadRequestError } from "../errors/badRequestError";

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  const e = normalizeError(err);

  logger[e.statusCode >= 500 ? "error" : "warn"](
    {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl,
      statusCode: e.statusCode,
      userId: req.user?.userId,
      err: e,
    },
    "request failed",
  );

  // Response already started — can't send a body, let Express destroy the socket.
  if (res.headersSent) return next(err);

  const leaky = e.statusCode >= 500 || !e.isOperational;
  const body =
    leaky && config.isProduction
      ? { error: "internal_error", message: "An unexpected error occurred" }
      : e.toResponse();

  res.status(e.statusCode).json({ ...body, requestId: req.id });
};

const { PostgresError } = postgres;

function fromPostgres(err: InstanceType<typeof PostgresError>): CustomError {
  switch (err.code) {
    case "23505": // unique_violation
      return new ConflictError(
        `Duplicate value violates ${err.constraint_name ?? "unique constraint"}`,
        { cause: err, clientMessage: "A record with this value already exists" },
      );
    case "23503": // foreign_key_violation
      return new ValidationError([], "Referenced record does not exist", {
        cause: err,
        type: ErrorType.VALIDATION_FAILED,
      });
    case "23502": // not_null_violation
      return new ValidationError(
        [],
        `Missing required field: ${err.column_name ?? "unknown"}`,
        { cause: err, clientMessage: "A required field is missing" },
      );
    default:
      return new DatabaseError(`Database error ${err.code}: ${err.message}`, {
        cause: err,
      });
  }
}

// Only trust the status on errors known to come from Express or its body parser.
function fromExpress(err: unknown): CustomError | undefined {
  if (!(err instanceof Error)) return undefined;
  const { status, expose } = err as { status?: number; expose?: boolean };
  if (status === undefined || status < 400 || status > 499) return undefined;

  // The router throws URIError when a route param has invalid percent-encoding.
  if (err instanceof URIError) {
    return new BadRequestError("Malformed URL", status, { cause: err });
  }
  // body-parser uses http-errors, which marks messages safe to show with `expose`.
  if (expose === true) {
    return new BadRequestError(err.message, status, { cause: err });
  }
  return undefined;
}

export function normalizeError(err: unknown): CustomError {
  if (err instanceof CustomError) return err;
  if (err instanceof ZodError) return ValidationError.fromZod(err);
  if (err instanceof PostgresError) return fromPostgres(err);

  // express.json() on a malformed body throws SyntaxError with status 400
  if (
    err instanceof SyntaxError &&
    (err as { status?: number }).status === 400
  ) {
    return new ValidationError([], "Malformed JSON body", { cause: err });
  }

  const expressError = fromExpress(err);
  if (expressError) return expressError;

  return new GenericError(
    err instanceof Error ? err.message : `Non-error thrown: ${String(err)}`,
    { cause: err },
  );
}
