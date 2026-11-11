import { describe, expect, it } from "vitest";
import type { Request, RequestHandler } from "express";
import { SignJWT, UnsecuredJWT } from "jose";
import { config } from "@/core/config";
import { BadRequestError } from "@/core/errors/badRequestError";
import { ErrorType } from "@/core/errors/errorTypes";
import { AuthenticationError } from "@/feature/auth/errors/authenticationError";
import { AuthorizationError } from "@/feature/auth/errors/authorizationError";
import {
  authenticate,
  requireAdmin,
  requireLoggedin,
  requireSelfOrAdmin,
  type SudokuAppJwtPayload,
} from "@/feature/auth/middleware/authentication";
import {
  mockNext,
  mockRequest,
  mockResponse,
  type MockRequestInit,
} from "#test/helpers/express";

const USER_ID = "3f0c7a4e-1b2d-4c5e-8f9a-0b1c2d3e4f5a";
const OTHER_ID = "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d";
const SECRET = new TextEncoder().encode(config.jwtSecret);
const nowSeconds = () => Math.floor(Date.now() / 1000);

interface TokenOptions {
  role?: SudokuAppJwtPayload["role"];
  sub?: string;
  secret?: Uint8Array;
  alg?: string;
  issuer?: string;
  audience?: string;
  exp?: number | string;
}

// Mirrors the claims authenticationServiceImpl puts in access tokens.
function token({
  role = "user",
  sub = USER_ID,
  secret = SECRET,
  alg = "HS256",
  issuer = config.issuer,
  audience = config.audience,
  exp = "15m",
}: TokenOptions = {}) {
  return new SignJWT({ role, emailVerified: true })
    .setProtectedHeader({ alg })
    .setSubject(sub)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(secret);
}

const bearer = (jwt: string) => ({ headers: { authorization: `Bearer ${jwt}` } });

function user(sub: string | undefined = USER_ID, role: SudokuAppJwtPayload["role"] = "user") {
  return { sub, role, emailVerified: true } as SudokuAppJwtPayload;
}

function run(handler: RequestHandler, init: MockRequestInit = {}) {
  const req = mockRequest<Request>(init);
  const next = mockNext();
  const result = Promise.resolve(handler(req, mockResponse(), next));
  return { req, next, result };
}

async function expectRejection(
  promise: Promise<unknown>,
  ErrorClass: typeof AuthenticationError | typeof AuthorizationError | typeof BadRequestError,
  code: ErrorType,
) {
  const err = await promise.then(
    () => {
      throw new Error("expected the middleware to throw");
    },
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(ErrorClass);
  expect((err as AuthenticationError).code).toBe(code);
  return err as InstanceType<typeof ErrorClass>;
}

describe("authenticate", () => {
  // Never blocks a request: it sets req.user or req.authError and calls next()
  // exactly once, leaving the decision to the guards.
  async function authenticated(init: MockRequestInit) {
    const { req, next, result } = run(authenticate, init);
    await result;
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
    return req;
  }

  it("sets req.user from a valid Bearer token", async () => {
    const req = await authenticated(bearer(await token({ role: "admin" })));
    expect(req.user).toMatchObject({ sub: USER_ID, role: "admin", emailVerified: true });
    expect(req.authError).toBeUndefined();
  });

  it("sets req.user from a valid accessToken cookie", async () => {
    const req = await authenticated({ cookies: { accessToken: await token() } });
    expect(req.user?.sub).toBe(USER_ID);
  });

  it("prefers the Authorization header over the cookie", async () => {
    const req = await authenticated({
      ...bearer(await token({ sub: USER_ID })),
      cookies: { accessToken: await token({ sub: OTHER_ID }) },
    });
    expect(req.user?.sub).toBe(USER_ID);
  });

  it("falls back to the cookie when the header is not a Bearer token", async () => {
    const req = await authenticated({
      headers: { authorization: "Basic dXNlcjpwYXNz" },
      cookies: { accessToken: await token() },
    });
    expect(req.user?.sub).toBe(USER_ID);
  });

  it.each([
    ["no header or cookie", {}],
    ["an empty Bearer token", { headers: { authorization: "Bearer " } }],
    ["a non-Bearer header and no cookie", { headers: { authorization: "Basic abc" } }],
    ["an empty cookie", { cookies: { accessToken: "" } }],
  ])("treats %s as anonymous", async (_label, init) => {
    const req = await authenticated(init);
    expect(req.user).toBeUndefined();
    expect(req.authError).toBeUndefined();
  });

  it("records TOKEN_EXPIRED for an expired token", async () => {
    const req = await authenticated(bearer(await token({ exp: nowSeconds() - 60 })));
    expect(req.user).toBeUndefined();
    expect(req.authError).toBe(ErrorType.TOKEN_EXPIRED);
  });

  it.each([
    ["signed with another secret", () => token({ secret: new TextEncoder().encode("x".repeat(48)) })],
    ["signed with HS512", () => token({ alg: "HS512" })],
    ["with the wrong issuer", () => token({ issuer: "http://evil.test" })],
    ["with the wrong audience", () => token({ audience: "http://evil.test" })],
    ["unsigned (alg: none)", async () =>
      new UnsecuredJWT({ role: "admin", sub: USER_ID })
        .setIssuer(config.issuer)
        .setAudience(config.audience)
        .setExpirationTime("15m")
        .encode()],
    ["that is not a JWT", async () => "not-a-jwt"],
    ["with a tampered payload", async () => {
      const [header, , signature] = (await token({ role: "user" })).split(".");
      const payload = Buffer.from(
        JSON.stringify({ role: "admin", sub: USER_ID, iss: config.issuer, aud: config.audience, exp: nowSeconds() + 900 }),
      ).toString("base64url");
      return `${header}.${payload}.${signature}`;
    }],
  ])("records TOKEN_INVALID for a token %s", async (_label, makeToken) => {
    const req = await authenticated(bearer(await makeToken()));
    expect(req.user).toBeUndefined();
    expect(req.authError).toBe(ErrorType.TOKEN_INVALID);
  });
});

describe("requireLoggedin", () => {
  it.each(["user", "admin"] as const)("lets a %s through", async (role) => {
    const { next, result } = run(requireLoggedin, { user: user(USER_ID, role) });
    await result;
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects an anonymous request as TOKEN_MISSING", async () => {
    const { next, result } = run(requireLoggedin);
    await expectRejection(result, AuthenticationError, ErrorType.TOKEN_MISSING);
    expect(next).not.toHaveBeenCalled();
  });

  it.each([ErrorType.TOKEN_EXPIRED, ErrorType.TOKEN_INVALID])(
    "rejects with the recorded %s error",
    async (authError) => {
      const { next, result } = run(requireLoggedin, { authError });
      await expectRejection(result, AuthenticationError, authError);
      expect(next).not.toHaveBeenCalled();
    },
  );
});

describe("requireAdmin", () => {
  it("lets an admin through", async () => {
    const { next, result } = run(requireAdmin, { user: user(USER_ID, "admin") });
    await result;
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects a logged-in non-admin with INSUFFICIENT_ROLE", async () => {
    const { next, result } = run(requireAdmin, { user: user(USER_ID, "user") });
    await expectRejection(result, AuthorizationError, ErrorType.INSUFFICIENT_ROLE);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects an anonymous request as TOKEN_MISSING", async () => {
    const { next, result } = run(requireAdmin);
    await expectRejection(result, AuthenticationError, ErrorType.TOKEN_MISSING);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects with the recorded error when the token was bad", async () => {
    const { result } = run(requireAdmin, { authError: ErrorType.TOKEN_EXPIRED });
    await expectRejection(result, AuthenticationError, ErrorType.TOKEN_EXPIRED);
  });
});

describe("requireSelfOrAdmin", () => {
  const handler = requireSelfOrAdmin as unknown as RequestHandler;

  it.each(["not-a-uuid", "", "123"])(
    "rejects a non-uuid id (%j) with a 400 before checking auth",
    async (id) => {
      const { next, result } = run(handler, { params: { id }, user: user() });
      const err = await expectRejection(result, BadRequestError, ErrorType.BAD_REQUEST);
      expect(err.statusCode).toBe(400);
      expect(next).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["no req.user", undefined],
    ["a user without a subject", { role: "user", emailVerified: true } as SudokuAppJwtPayload],
  ])("rejects %s as TOKEN_MISSING", async (_label, reqUser) => {
    const { next, result } = run(handler, { params: { id: USER_ID }, user: reqUser });
    await expectRejection(result, AuthenticationError, ErrorType.TOKEN_MISSING);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows a user to access their own id", async () => {
    const { next, result } = run(handler, { params: { id: USER_ID }, user: user(USER_ID) });
    await result;
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it("allows an admin to access another user's id", async () => {
    const { next, result } = run(handler, {
      params: { id: OTHER_ID },
      user: user(USER_ID, "admin"),
    });
    await result;
    expect(next).toHaveBeenCalledOnce();
  });

  it("rejects a non-admin accessing another user's id", async () => {
    const { next, result } = run(handler, { params: { id: OTHER_ID }, user: user(USER_ID) });
    await expectRejection(result, AuthorizationError, ErrorType.INSUFFICIENT_ROLE);
    expect(next).not.toHaveBeenCalled();
  });
});
