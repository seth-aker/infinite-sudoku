import { describe, expect, it } from "vitest";
import type { Request, RequestHandler } from "express";
import * as z from "zod/v4";
import {
  loginBodyValidator,
  passwordResetValidator,
  registerBodyValidator,
  resetRequestValidator,
  mobileLoginBodyValidator,
  mobileRefreshBodyValidator,
  validateEmailTokenValidator,
} from "@/feature/auth/middleware/validation";
import { mockNext, mockRequest, mockResponse } from "#test/helpers/express";

const STRONG_PASSWORD = "Str0ng!pass";
const TOKEN = "3f0c7a4e-1b2d-4c5e-8f9a-0b1c2d3e4f5a";

// Some validators throw the ZodError and some pass it to next(); both reach
// the errorHandler the same way, so normalise them here.
function run(handler: RequestHandler, body: unknown, query: Record<string, unknown> = {}) {
  const req = mockRequest<Request>({ body, query });
  const next = mockNext();
  let thrown: unknown;
  try {
    handler(req, mockResponse(), next);
  } catch (err) {
    thrown = err;
  }
  const error = thrown ?? next.mock.calls[0]?.[0];
  return { req, next, error };
}

function expectPass(handler: RequestHandler, body: unknown) {
  const result = run(handler, body);
  expect(result.error).toBeUndefined();
  expect(result.next).toHaveBeenCalledOnce();
  expect(result.next).toHaveBeenCalledWith();
  return result;
}

function expectFail(handler: RequestHandler, body: unknown, path?: string) {
  const result = run(handler, body);
  expect(result.error).toBeInstanceOf(z.ZodError);
  if (path !== undefined) {
    const paths = (result.error as z.ZodError).issues.map((i) => i.path.join("."));
    expect(paths).toContain(path);
  }
  // next must not also be called with no arguments (which would run the route).
  expect(result.next.mock.calls.filter((c) => c.length === 0)).toHaveLength(0);
  return result;
}

describe("password rules (register and reset)", () => {
  const register = (password: unknown) => ({
    email: "a@b.co",
    username: "player",
    password,
    tosAcknowledged: true,
  });

  it.each([
    "Str0ng!pass",
    "Aa1#aaaa",
    "Aa1 aaaa", // space counts as a special character
    "Aa1-" + "a".repeat(100),
  ])("accepts %j", (password) => {
    expectPass(registerBodyValidator, register(password));
    expectPass(passwordResetValidator, { password, token: TOKEN });
  });

  it.each([
    ["too short", "Aa1#aaa"],
    ["no uppercase", "aa1#aaaa"],
    ["no lowercase", "AA1#AAAA"],
    ["no number", "Aaa#aaaa"],
    ["no special character", "Aa1aaaaa"],
    ["an unlisted special character only", "Aa1_aaaa"],
    ["empty", ""],
    ["not a string", 12345678],
  ])("rejects a password with %s", (_label, password) => {
    expectFail(registerBodyValidator, register(password), "password");
    expectFail(passwordResetValidator, { password, token: TOKEN });
  });
});

describe("loginBodyValidator", () => {
  it("accepts an email and an 8+ character password", () => {
    expectPass(loginBodyValidator, { email: "a@b.co", password: "whatever" });
  });

  it("does not apply the strength rules, so old passwords still log in", () => {
    expectPass(loginBodyValidator, { email: "a@b.co", password: "alllowercase" });
  });

  it.each([
    ["an invalid email", { email: "nope", password: "whatever" }, "email"],
    ["a missing email", { password: "whatever" }, "email"],
    ["a short password", { email: "a@b.co", password: "short" }, "password"],
    ["a missing password", { email: "a@b.co" }, "password"],
    ["a non-string email", { email: ["a@b.co"], password: "whatever" }, "email"],
  ])("rejects %s", (_label, body, path) => {
    expectFail(loginBodyValidator, body, path);
  });

  it.each([undefined, null, "string body"])("rejects a %j body", (body) => {
    expectFail(loginBodyValidator, body);
  });
});

describe("registerBodyValidator", () => {
  const valid = {
    email: "a@b.co",
    username: "player",
    password: STRONG_PASSWORD,
    tosAcknowledged: true,
  };

  it("accepts a valid body", () => {
    expectPass(registerBodyValidator, valid);
  });

  it.each([
    ["an invalid email", { email: "nope" }, "email"],
    ["a short username", { username: "abc" }, "username"],
    ["a string tosAcknowledged", { tosAcknowledged: "true" }, "tosAcknowledged"],
    ["a missing tosAcknowledged", { tosAcknowledged: undefined }, "tosAcknowledged"],
  ])("rejects %s", (_label, override, path) => {
    expectFail(registerBodyValidator, { ...valid, ...override }, path);
  });
});

describe("mobileLoginBodyValidator", () => {
  it("accepts an email and password", () => {
    expectPass(mobileLoginBodyValidator, { email: "a@b.co", password: "pass" });
  });

  it("replaces req.body with the parsed data, dropping unknown fields", () => {
    const { req } = expectPass(mobileLoginBodyValidator, {
      email: "a@b.co",
      password: "pass",
      grantType: "password",
      role: "admin",
    });
    expect(req.body).toEqual({ email: "a@b.co", password: "pass" });
  });

  it.each([
    ["a refresh token body", { refreshToken: "rt" }],
    ["a short password", { email: "a@b.co", password: "abc" }],
    ["a short email", { email: "a@b", password: "pass" }],
    ["a missing password", { email: "a@b.co" }],
    ["a non-string email", { email: ["a@b.co"], password: "pass" }],
    ["no body", undefined],
  ])("rejects %s", (_label, body) => {
    const { req } = expectFail(mobileLoginBodyValidator, body);
    expect(req.body).toEqual(body);
  });
});

describe("mobileRefreshBodyValidator", () => {
  it("accepts a refresh token", () => {
    expectPass(mobileRefreshBodyValidator, { refreshToken: "rt" });
  });

  it("replaces req.body with the parsed data, dropping unknown fields", () => {
    const { req } = expectPass(mobileRefreshBodyValidator, {
      refreshToken: "rt",
      grantType: "refreshToken",
      email: "a@b.co",
    });
    expect(req.body).toEqual({ refreshToken: "rt" });
  });

  it.each([
    ["a login body", { email: "a@b.co", password: "pass" }],
    ["an empty token", { refreshToken: "" }],
    ["a non-string token", { refreshToken: 5 }],
    ["no body", undefined],
  ])("rejects %s", (_label, body) => {
    const { req } = expectFail(mobileRefreshBodyValidator, body);
    expect(req.body).toEqual(body);
  });
});

describe("resetRequestValidator", () => {
  it("accepts a valid email", () => {
    expectPass(resetRequestValidator, { email: "a@b.co" });
  });

  it.each([
    ["an invalid email", { email: "nope" }],
    ["a missing email", {}],
    ["no body", undefined],
  ])("rejects %s", (_label, body) => {
    expectFail(resetRequestValidator, body);
  });
});

describe("passwordResetValidator", () => {
  it("accepts a strong password and a uuid token", () => {
    expectPass(passwordResetValidator, { password: STRONG_PASSWORD, token: TOKEN });
  });

  it.each([
    ["a non-uuid token", { password: STRONG_PASSWORD, token: "abc" }],
    ["a missing token", { password: STRONG_PASSWORD }],
    ["a missing password", { token: TOKEN }],
    ["no body", undefined],
  ])("rejects %s", (_label, body) => {
    expectFail(passwordResetValidator, body);
  });

  it("reports a weak password even when the token is also bad", () => {
    const { error } = expectFail(passwordResetValidator, { password: "weak", token: "abc" });
    const messages = (error as z.ZodError).issues.map((i) => i.message);
    expect(messages).toContainEqual(expect.stringMatching(/Password must contain/));
  });
});

describe("validateEmailTokenValidator", () => {
  const runQuery = (query: Record<string, unknown>) => run(validateEmailTokenValidator, undefined, query);

  it("accepts a uuid token in the query string", () => {
    const { error, next } = runQuery({ token: TOKEN });
    expect(error).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  it.each([
    ["a missing token", {}],
    ["an empty token", { token: "" }],
    ["a non-uuid token", { token: "abc" }],
    ["a repeated token", { token: [TOKEN, TOKEN] }],
  ])("rejects %s", (_label, query) => {
    const { error, next } = runQuery(query);
    expect(error).toBeInstanceOf(z.ZodError);
    expect(next.mock.calls.filter((c) => c.length === 0)).toHaveLength(0);
  });
});
