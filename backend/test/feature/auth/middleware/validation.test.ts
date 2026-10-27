import { describe, expect, it } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod/v4";
import {
  loginBodySchema,
  loginBodyValidator,
  passwordResetValidator,
  registerBodySchema,
  registerBodyValidator,
  resetRequestValidator,
  tokenBodyValidator,
} from "@/feature/auth/middleware/validation";
import { mockNext, mockRequest, mockResponse } from "#test/helpers/express";
import { RESET_TOKEN, VALID_PASSWORD } from "#test/helpers/fixtures";

type Validator = (req: Request, res: Response, next: NextFunction) => void;

function run(validator: Validator, body: unknown) {
  const req = mockRequest<Request>({ body });
  const next = mockNext();
  let thrown: unknown;
  try {
    validator(req, mockResponse(), next);
  } catch (e) {
    thrown = e;
  }
  return { req, next, thrown };
}

const validRegister = {
  email: "new@user.com",
  username: "newbie",
  password: VALID_PASSWORD,
  tosAcknowledged: true,
};

const invalidPasswords: [string, string][] = [
  ["too short", "Ab1!abc"],
  ["missing uppercase", "str0ng!pass"],
  ["missing lowercase", "STR0NG!PASS"],
  ["missing number", "Strong!Pass"],
  ["missing special character", "Str0ngPass1"],
  ["empty", ""],
];

describe("loginBodySchema / loginBodyValidator", () => {
  it("passes a valid body", () => {
    const { next, thrown } = run(loginBodyValidator, {
      email: "a@b.co",
      password: "12345678",
    });
    expect(thrown).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  it.each([
    ["invalid email", { email: "nope", password: "12345678" }],
    ["short password", { email: "a@b.co", password: "1234567" }],
    ["missing password", { email: "a@b.co" }],
    ["missing email", { password: "12345678" }],
    ["non-string password", { email: "a@b.co", password: 12345678 }],
  ])("throws a ZodError for %s", (_label, body) => {
    const { next, thrown } = run(loginBodyValidator, body);
    expect(thrown).toBeInstanceOf(ZodError);
    expect(next).not.toHaveBeenCalled();
  });

  it("throws when the body is missing", () => {
    expect(run(loginBodyValidator, undefined).thrown).toBeInstanceOf(ZodError);
  });

  it("is exported for reuse", () => {
    expect(
      loginBodySchema.safeParse({ email: "a@b.co", password: "x".repeat(8) })
        .success,
    ).toBe(true);
  });
});

describe("registerBodySchema / registerBodyValidator", () => {
  it("passes a valid body", () => {
    const { next, thrown } = run(registerBodyValidator, validRegister);
    expect(thrown).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  it("accepts tosAcknowledged=false at the schema level", () => {
    expect(
      registerBodySchema.safeParse({ ...validRegister, tosAcknowledged: false })
        .success,
    ).toBe(true);
  });

  it.each(["#", "?", "!", "@", "$", " ", "%", "^", "&", "*", "-"])(
    "accepts the special character %j",
    (char) => {
      const password = `Abcdef1${char}`;
      expect(
        registerBodySchema.safeParse({ ...validRegister, password }).success,
      ).toBe(true);
    },
  );

  it.each(invalidPasswords)("rejects a password %s", (_label, password) => {
    const { thrown } = run(registerBodyValidator, {
      ...validRegister,
      password,
    });
    expect(thrown).toBeInstanceOf(ZodError);
    expect((thrown as ZodError).issues[0].message).toMatch(
      /^Password must contain/,
    );
  });

  it.each([
    ["invalid email", { email: "x" }],
    ["short username", { username: "abc" }],
    ["missing tos", { tosAcknowledged: undefined }],
    ["string tos", { tosAcknowledged: "true" }],
  ])("rejects %s", (_label, override) => {
    const { thrown, next } = run(registerBodyValidator, {
      ...validRegister,
      ...override,
    });
    expect(thrown).toBeInstanceOf(ZodError);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("tokenBodyValidator", () => {
  it("accepts a password grant and strips unknown fields", () => {
    const { req, next } = run(tokenBodyValidator, {
      grantType: "password",
      email: "a@b.c",
      password: "abcd",
      extra: "drop me",
    });
    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({
      grantType: "password",
      email: "a@b.c",
      password: "abcd",
    });
  });

  it("accepts a refresh token grant", () => {
    const { req, next } = run(tokenBodyValidator, {
      grantType: "refreshToken",
      refreshToken: "t",
    });
    expect(next).toHaveBeenCalledWith();
    expect(req.body).toEqual({ grantType: "refreshToken", refreshToken: "t" });
  });

  it.each([
    ["missing grant type", { email: "a@b.c", password: "abcd" }],
    ["unknown grant type", { grantType: "magic" }],
    ["short email", { grantType: "password", email: "a@b", password: "abcd" }],
    [
      "short password",
      { grantType: "password", email: "a@b.c", password: "abc" },
    ],
    ["empty refresh token", { grantType: "refreshToken", refreshToken: "" }],
    ["refresh grant without token", { grantType: "refreshToken" }],
    ["undefined body", undefined],
  ])("forwards a ZodError for %s", (_label, body) => {
    const { req, next, thrown } = run(tokenBodyValidator, body);
    expect(thrown).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(ZodError);
    expect(req.body).toBe(body);
  });
});

describe("resetRequestValidator", () => {
  it("passes a valid email", () => {
    const { next } = run(resetRequestValidator, { email: "a@b.co" });
    expect(next).toHaveBeenCalledWith();
  });

  it.each([
    ["invalid email", { email: "nope" }],
    ["missing email", {}],
    ["undefined body", undefined],
  ])("forwards a ZodError for %s", (_label, body) => {
    const { next } = run(resetRequestValidator, body);
    expect(next.mock.calls[0][0]).toBeInstanceOf(ZodError);
  });
});

describe("passwordResetValidator", () => {
  it("passes a strong password and uuid token", () => {
    const { next } = run(passwordResetValidator, {
      password: VALID_PASSWORD,
      token: RESET_TOKEN,
    });
    expect(next).toHaveBeenCalledWith();
  });

  it.each(invalidPasswords)(
    "forwards a ZodError for a password %s",
    (_label, password) => {
      const { next } = run(passwordResetValidator, {
        password,
        token: RESET_TOKEN,
      });
      expect(next).toHaveBeenCalledTimes(1);
      expect(next.mock.calls[0][0]).toBeInstanceOf(ZodError);
    },
  );

  it.each([
    ["non-uuid token", "abc"],
    ["missing token", undefined],
  ])("forwards a ZodError for a %s", (_label, token) => {
    const { next } = run(passwordResetValidator, {
      password: VALID_PASSWORD,
      token,
    });
    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0] as ZodError;
    expect(err).toBeInstanceOf(ZodError);
    expect(err.issues[0].message).not.toMatch(/^Password/);
  });

  it("forwards a ZodError for an undefined body", () => {
    const { next } = run(passwordResetValidator, undefined);
    expect(next.mock.calls[0][0]).toBeInstanceOf(ZodError);
  });
});
