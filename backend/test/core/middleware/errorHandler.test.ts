import { afterEach, beforeEach, describe, expect, it } from "vitest";
import postgres from "postgres";
import * as z from "zod/v4";
import { errorHandler, normalizeError } from "@/core/middleware/errorHandler";
import { config } from "@/core/config";
import { logger } from "@/core/logging/logger";
import { NotFoundError } from "@/core/errors/notFoundError";
import { ValidationError } from "@/core/errors/validationError";
import { ConflictError } from "@/core/errors/conflictError";
import { DatabaseError } from "@/core/errors/databaseError";
import { GenericError } from "@/core/errors/genericError";
import { ErrorType } from "@/core/errors/errorTypes";
import { mockNext, mockRequest, mockResponse } from "#test/helpers/express";

const { PostgresError } = postgres;

function pgError(fields: Record<string, unknown>) {
  return new PostgresError({ message: "pg failure", ...fields } as never);
}

describe("normalizeError", () => {
  it("returns CustomErrors untouched", () => {
    const err = new NotFoundError("missing");
    expect(normalizeError(err)).toBe(err);
  });

  it("converts ZodErrors into ValidationErrors", () => {
    const zodErr = z.object({ a: z.string() }).safeParse({}).error!;
    const err = normalizeError(zodErr);
    expect(err).toBeInstanceOf(ValidationError);
    expect((err as ValidationError).issues[0].path).toBe("a");
  });

  describe("PostgresError", () => {
    it("maps unique violations to ConflictError with the constraint", () => {
      const cause = pgError({ code: "23505", constraint_name: "users_email" });
      const err = normalizeError(cause);
      expect(err).toBeInstanceOf(ConflictError);
      expect(err.message).toBe("Duplicate value violates users_email");
      expect(err.cause).toBe(cause);
    });

    it("maps unique violations without a constraint name", () => {
      const err = normalizeError(pgError({ code: "23505" }));
      expect(err.message).toBe("Duplicate value violates unique constraint");
    });

    it("maps foreign key violations to ValidationError", () => {
      const cause = pgError({ code: "23503" });
      const err = normalizeError(cause);
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.message).toBe("Referenced record does not exist");
      expect(err.code).toBe(ErrorType.VALIDATION_FAILED);
      expect(err.cause).toBe(cause);
    });

    it("maps not null violations with the column name", () => {
      const cause = pgError({ code: "23502", column_name: "email" });
      const err = normalizeError(cause);
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.message).toBe("Missing required field: email");
      expect(err.cause).toBe(cause);
    });

    it("maps not null violations without a column name", () => {
      const err = normalizeError(pgError({ code: "23502" }));
      expect(err.message).toBe("Missing required field: unknown");
    });

    it("maps other codes to DatabaseError", () => {
      const cause = pgError({ code: "42P01", message: "no table" });
      const err = normalizeError(cause);
      expect(err).toBeInstanceOf(DatabaseError);
      expect(err.message).toBe("Database error 42P01: no table");
      expect(err.isOperational).toBe(false);
      expect(err.cause).toBe(cause);
    });
  });

  it("maps body-parser SyntaxErrors (status 400) to ValidationError", () => {
    const cause = Object.assign(new SyntaxError("Unexpected token"), {
      status: 400,
    });
    const err = normalizeError(cause);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toBe("Malformed JSON body");
    expect(err.cause).toBe(cause);
  });

  it("treats SyntaxErrors without status 400 as generic errors", () => {
    const err = normalizeError(new SyntaxError("bad code"));
    expect(err).toBeInstanceOf(GenericError);
    expect(err.message).toBe("bad code");
  });

  it("wraps plain Errors in GenericError", () => {
    const cause = new Error("kaboom");
    const err = normalizeError(cause);
    expect(err).toBeInstanceOf(GenericError);
    expect(err.message).toBe("kaboom");
    expect(err.statusCode).toBe(500);
    expect(err.cause).toBe(cause);
  });

  it.each([
    ["a string", "oops", "Non-error thrown: oops"],
    ["a number", 42, "Non-error thrown: 42"],
    ["undefined", undefined, "Non-error thrown: undefined"],
    ["null", null, "Non-error thrown: null"],
    ["an object", { a: 1 }, "Non-error thrown: [object Object]"],
  ])("wraps non-errors (%s) in GenericError", (_label, value, message) => {
    const err = normalizeError(value);
    expect(err).toBeInstanceOf(GenericError);
    expect(err.message).toBe(message);
    expect(err.cause).toBe(value);
  });
});

describe("errorHandler", () => {
  const originalIsProduction = config.isProduction;

  beforeEach(() => {
    config.isProduction = false;
  });

  afterEach(() => {
    config.isProduction = originalIsProduction;
  });

  function run(err: unknown, reqInit = {}, resInit = {}) {
    const req = mockRequest({
      id: "req-1",
      method: "POST",
      originalUrl: "/api/thing",
      ...reqInit,
    });
    const res = mockResponse(resInit);
    const next = mockNext();
    errorHandler(err, req, res, next);
    return { req, res, next };
  }

  it("responds with the error status and body including the request id", () => {
    const { res, next } = run(new NotFoundError("nope"));
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: "resource_not_found",
      message: "nope",
      requestId: "req-1",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("logs 4xx errors as warnings with request context", () => {
    const err = new NotFoundError("nope");
    run(err, { user: { userId: "u1" } });
    expect(logger.warn).toHaveBeenCalledWith(
      {
        requestId: "req-1",
        method: "POST",
        path: "/api/thing",
        statusCode: 404,
        userId: "u1",
        err,
      },
      "request failed",
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("logs 5xx errors as errors", () => {
    run(new Error("crash"));
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, userId: undefined }),
      "request failed",
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("delegates to next when headers were already sent", () => {
    const err = new Error("late");
    const { res, next } = run(err, {}, { headersSent: true });
    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("exposes 5xx details outside production", () => {
    const { res } = run(new Error("crash detail"));
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "internal_error",
      message: "crash detail",
      requestId: "req-1",
    });
  });

  it("hides 5xx details in production", () => {
    config.isProduction = true;
    const { res } = run(new Error("crash detail"));
    expect(res.json).toHaveBeenCalledWith({
      error: "internal_error",
      message: "An unexpected error occurred",
      requestId: "req-1",
    });
  });

  it("hides non-operational errors in production even below 500", () => {
    config.isProduction = true;
    class NonOperational extends NotFoundError {
      readonly isOperational = false;
    }
    const { res } = run(new NonOperational("secret"));
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: "internal_error",
      message: "An unexpected error occurred",
      requestId: "req-1",
    });
  });

  it("returns operational 4xx details in production", () => {
    config.isProduction = true;
    const { res } = run(new ValidationError([{ path: "a", message: "b" }]));
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "validation_failed",
      message: "Request validation failed",
      issues: [{ path: "a", message: "b" }],
      requestId: "req-1",
    });
  });
});
