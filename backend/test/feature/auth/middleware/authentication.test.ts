import { describe, expect, it } from "vitest";
import type { Request, RequestHandler } from "express";
import { SignJWT, UnsecuredJWT } from "jose";
import { config } from "@/core/config";
import { BadRequestError } from "@/core/errors/badRequestError";
import { ErrorType } from "@/core/errors/errorTypes";
import { AuthenticationError } from "@/feature/auth/errors/authenticationError";
import { AuthorizationError } from "@/feature/auth/errors/authorizationError";
import {
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

function run(handler: RequestHandler, init: MockRequestInit = {}) {
  const req = mockRequest<Request>(init);
  const res = mockResponse();
  const next = mockNext();
  const result = handler(req, res, next) as unknown as Promise<void>;
  return { req, res, next, result };
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

// requireLoggedin and requireAdmin share token extraction and verification.
describe.each([
  ["requireLoggedin", requireLoggedin, "user"],
  ["requireAdmin", requireAdmin, "admin"],
] as const)("%s token handling", (_name, middleware, role) => {
  it("accepts a valid Bearer token and sets req.user", async () => {
    const { req, next, result } = run(middleware, bearer(await token({ role })));
    await result;
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toMatchObject({ sub: USER_ID, role });
  });

  it("accepts a valid accessToken cookie", async () => {
    const { req, next, result } = run(middleware, {
      cookies: { accessToken: await token({ role }) },
    });
    await result;
    expect(next).toHaveBeenCalledOnce();
    expect(req.user?.sub).toBe(USER_ID);
  });

  it("prefers the Authorization header over the cookie", async () => {
    const { req, result } = run(middleware, {
      ...bearer(await token({ role, sub: USER_ID })),
      cookies: { accessToken: await token({ role, sub: OTHER_ID }) },
    });
    await result;
    expect(req.user?.sub).toBe(USER_ID);
  });

  it("falls back to the cookie when the header is not a Bearer token", async () => {
    const { req, result } = run(middleware, {
      headers: { authorization: "Basic dXNlcjpwYXNz" },
      cookies: { accessToken: await token({ role }) },
    });
    await result;
    expect(req.user?.sub).toBe(USER_ID);
  });

  it.each([
    ["no header or cookie", {}],
    ["an empty Bearer token", { headers: { authorization: "Bearer " } }],
    ["a non-Bearer header and no cookie", { headers: { authorization: "Basic abc" } }],
    ["an empty cookie", { cookies: { accessToken: "" } }],
  ])("rejects %s as TOKEN_MISSING", async (_label, init) => {
    const { next, result } = run(middleware, init);
    await expectRejection(result, AuthenticationError, ErrorType.TOKEN_MISSING);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects an expired token as TOKEN_EXPIRED", async () => {
    const jwt = await token({ role, exp: nowSeconds() - 60 });
    const { next, result } = run(middleware, bearer(jwt));
    await expectRejection(result, AuthenticationError, ErrorType.TOKEN_EXPIRED);
    expect(next).not.toHaveBeenCalled();
  });

  it.each([
    ["signed with another secret", () => token({ role, secret: new TextEncoder().encode("x".repeat(48)) })],
    ["signed with HS512", () => token({ role, alg: "HS512" })],
    ["with the wrong issuer", () => token({ role, issuer: "http://evil.test" })],
    ["with the wrong audience", () => token({ role, audience: "http://evil.test" })],
    ["unsigned (alg: none)", async () =>
      new UnsecuredJWT({ role, sub: USER_ID })
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
  ])("rejects a token %s as TOKEN_INVALID", async (_label, makeToken) => {
    const { req, next, result } = run(middleware, bearer(await makeToken()));
    await expectRejection(result, AuthenticationError, ErrorType.TOKEN_INVALID);
    expect(next).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });
});

describe("requireLoggedin", () => {
  it("accepts any role", async () => {
    const { next, result } = run(requireLoggedin, bearer(await token({ role: "user" })));
    await result;
    expect(next).toHaveBeenCalledOnce();
  });
});

describe("requireAdmin", () => {
  it("rejects a valid non-admin token with INSUFFICIENT_ROLE", async () => {
    const { req, next, result } = run(requireAdmin, bearer(await token({ role: "user" })));
    await expectRejection(result, AuthorizationError, ErrorType.INSUFFICIENT_ROLE);
    expect(next).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });
});

describe("requireSelfOrAdmin", () => {
  // Runs after requireLoggedin, so req.user is already populated.
  function user(sub: string | undefined, role: SudokuAppJwtPayload["role"] = "user") {
    return { sub, role, emailVerified: true } as SudokuAppJwtPayload;
  }

  it.each(["not-a-uuid", "", "123"])(
    "rejects a non-uuid id (%j) with a 400 before checking auth",
    async (id) => {
      const { res, next, result } = run(requireSelfOrAdmin as RequestHandler, {
        params: { id },
        user: user(USER_ID),
      });
      const err = await expectRejection(result, BadRequestError, ErrorType.BAD_REQUEST);
      expect(err.statusCode).toBe(400);
      expect(next).not.toHaveBeenCalled();
      expect(res.sendStatus).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["no req.user", undefined],
    ["a user without a subject", user(undefined)],
  ])("rejects %s as TOKEN_MISSING", async (_label, reqUser) => {
    const { next, result } = run(requireSelfOrAdmin as RequestHandler, {
      params: { id: USER_ID },
      user: reqUser,
    });
    await expectRejection(result, AuthenticationError, ErrorType.TOKEN_MISSING);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows a user to access their own id", async () => {
    const { next, result } = run(requireSelfOrAdmin as RequestHandler, {
      params: { id: USER_ID },
      user: user(USER_ID),
    });
    await result;
    expect(next).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledWith();
  });

  it("allows an admin to access another user's id", async () => {
    const { next, result } = run(requireSelfOrAdmin as RequestHandler, {
      params: { id: OTHER_ID },
      user: user(USER_ID, "admin"),
      ...bearer(await token({ role: "admin" })),
    });
    await result;
    expect(next).toHaveBeenCalledOnce();
  });

  it("rejects a non-admin accessing another user's id", async () => {
    const { next, result } = run(requireSelfOrAdmin as RequestHandler, {
      params: { id: OTHER_ID },
      user: user(USER_ID),
      ...bearer(await token({ role: "user" })),
    });
    await expectRejection(result, AuthorizationError, ErrorType.INSUFFICIENT_ROLE);
    expect(next).not.toHaveBeenCalled();
  });

  it("re-verifies the token rather than trusting req.user.role", async () => {
    // req.user claims admin, but the actual token is a user token.
    const { next, result } = run(requireSelfOrAdmin as RequestHandler, {
      params: { id: OTHER_ID },
      user: user(USER_ID, "admin"),
      ...bearer(await token({ role: "user" })),
    });
    await expectRejection(result, AuthorizationError, ErrorType.INSUFFICIENT_ROLE);
    expect(next).not.toHaveBeenCalled();
  });
});
