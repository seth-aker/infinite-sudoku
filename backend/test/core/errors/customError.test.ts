import { describe, expect, it } from "vitest";
import { CustomError } from "@/core/errors/customError";
import { ErrorType } from "@/core/errors/errorTypes";

class TeapotError extends CustomError {
  readonly statusCode = 418;
  protected readonly defaultType: ErrorType = ErrorType.BAD_REQUEST;
}

class ChildTeapotError extends TeapotError {}

describe("CustomError", () => {
  it("stores message, status code and default code", () => {
    const err = new TeapotError("short and stout");
    expect(err.message).toBe("short and stout");
    expect(err.statusCode).toBe(418);
    expect(err.code).toBe(ErrorType.BAD_REQUEST);
    expect(err.isOperational).toBe(true);
    expect(err.clientMessage).toBeUndefined();
  });

  it("names the error after the concrete subclass", () => {
    expect(new TeapotError("x").name).toBe("TeapotError");
    expect(new ChildTeapotError("x").name).toBe("ChildTeapotError");
  });

  it("captures a stack trace that excludes the constructor frame", () => {
    const err = new TeapotError("x");
    expect(err.stack).toContain("TeapotError: x");
    expect(err.stack).not.toMatch(/at new TeapotError/);
  });

  it("works when Error.captureStackTrace is unavailable", () => {
    const original = Error.captureStackTrace;
    (Error as { captureStackTrace?: unknown }).captureStackTrace = undefined;
    try {
      expect(() => new TeapotError("x")).not.toThrow();
    } finally {
      Error.captureStackTrace = original;
    }
  });

  it("type override takes precedence over the default type", () => {
    const err = new TeapotError("x", { type: ErrorType.RATE_LIMITED });
    expect(err.code).toBe(ErrorType.RATE_LIMITED);
    expect(err.toResponse()).toEqual({
      error: ErrorType.RATE_LIMITED,
      message: "x",
    });
  });

  it("uses client message over message in responses", () => {
    const err = new TeapotError("secret", { clientMessage: "public" });
    expect(err.toResponse()).toEqual({
      error: ErrorType.BAD_REQUEST,
      message: "public",
    });
  });

  it("keeps an empty client message instead of falling back", () => {
    const err = new TeapotError("secret", { clientMessage: "" });
    expect(err.toResponse().message).toBe("");
  });

  it("forwards the cause to Error", () => {
    const cause = { reason: "anything" };
    expect(new TeapotError("x", { cause }).cause).toBe(cause);
  });
});
