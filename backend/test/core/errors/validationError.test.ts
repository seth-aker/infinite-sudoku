import { describe, expect, it } from "vitest";
import * as z from "zod/v4";
import { ValidationError } from "@/core/errors/validationError";
import { CustomError } from "@/core/errors/customError";
import { ErrorType } from "@/core/errors/errorTypes";

describe("ValidationError", () => {
  it("defaults to no issues and a generic message", () => {
    const err = new ValidationError();
    expect(err).toBeInstanceOf(CustomError);
    expect(err.issues).toEqual([]);
    expect(err.message).toBe("Request validation failed");
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe(ErrorType.VALIDATION_FAILED);
    expect(err.name).toBe("ValidationError");
  });

  it("accepts issues, message and options", () => {
    const cause = new Error("root");
    const err = new ValidationError([{ path: "a", message: "bad" }], "custom", {
      cause,
      clientMessage: "client",
    });
    expect(err.issues).toEqual([{ path: "a", message: "bad" }]);
    expect(err.message).toBe("custom");
    expect(err.cause).toBe(cause);
  });

  describe("toResponse", () => {
    it("includes issues and the message", () => {
      const err = new ValidationError([{ path: "x", message: "y" }], "msg");
      expect(err.toResponse()).toEqual({
        error: "validation_failed",
        message: "msg",
        issues: [{ path: "x", message: "y" }],
      });
    });

    it("prefers the client message", () => {
      const err = new ValidationError([], "msg", { clientMessage: "safe" });
      expect(err.toResponse().message).toBe("safe");
    });

    it("always reports validation_failed even with a type override", () => {
      const err = new ValidationError([], "msg", {
        type: ErrorType.MALFORMED_BODY,
      });
      expect(err.code).toBe(ErrorType.MALFORMED_BODY);
      expect(err.toResponse().error).toBe("validation_failed");
    });
  });

  describe("fromZod", () => {
    it("maps nested issue paths to dot notation", () => {
      const schema = z.object({ user: z.object({ age: z.number() }) });
      const result = schema.safeParse({ user: { age: "old" } });
      const err = ValidationError.fromZod(result.error!);
      expect(err).toBeInstanceOf(ValidationError);
      expect(err.issues).toEqual([
        {
          path: "user.age",
          message: expect.any(String),
          code: "invalid_type",
        },
      ]);
    });

    it("uses (root) for issues without a path", () => {
      const result = z.string().safeParse(5);
      const err = ValidationError.fromZod(result.error!);
      expect(err.issues[0].path).toBe("(root)");
    });

    it("includes array indices in paths", () => {
      const result = z.array(z.number()).safeParse([1, "two"]);
      const err = ValidationError.fromZod(result.error!);
      expect(err.issues[0].path).toBe("1");
    });

    it("maps every issue", () => {
      const schema = z.object({ a: z.string(), b: z.string() });
      const err = ValidationError.fromZod(schema.safeParse({}).error!);
      expect(err.issues.map((i) => i.path)).toEqual(["a", "b"]);
    });
  });
});
