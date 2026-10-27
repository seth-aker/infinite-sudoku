import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { SignJWT } from "jose";
import {
  requireAdmin,
  requireLoggedin,
  requireSelfOrAdmin,
} from "@/feature/auth/middleware/authentication";
import { AuthenticationError } from "@/feature/auth/errors/authenticationError";
import { AuthorizationError } from "@/feature/auth/errors/authorizationError";
import { ErrorType } from "@/core/errors/errorTypes";
import { config } from "@/core/config";
import { logger } from "@/core/logging/logger";
import {
  mockNext,
  mockRequest,
  mockResponse,
  type MockRequestInit,
} from "#test/helpers/express";
import { expiredTimestamp, signAccessToken } from "#test/helpers/jwt";
import { OTHER_USER_ID, USER_ID } from "#test/helpers/fixtures";

type Middleware = (
  req: Request<{ id: string }>,
  res: ReturnType<typeof mockResponse>,
  next: ReturnType<typeof mockNext>,
) => Promise<unknown>;

async function run(middleware: Middleware, init: MockRequestInit = {}) {
  const req = mockRequest<Request<{ id: string }>>(init);
  const res = mockResponse();
  const next = mockNext();
  const error = await middleware(req, res, next).then(
    () => undefined,
    (e: unknown) => e,
  );
  return { req, res, next, error };
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

async function hs512Token() {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS512" })
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setExpirationTime("15m")
    .sign(new TextEncoder().encode(config.jwtSecret));
}

function expectAuthError(error: unknown, type: string) {
  expect(error).toBeInstanceOf(AuthenticationError);
  expect((error as AuthenticationError).code).toBe(type);
}

const describeTokenVerification = (
  name: string,
  middleware: Middleware,
  role: "user" | "admin",
) => {
  describe(`${name} token verification`, () => {
    it("rejects requests without a token", async () => {
      const { error, next } = await run(middleware);
      expectAuthError(error, ErrorType.TOKEN_MISSING);
      expect(next).not.toHaveBeenCalled();
    });

    it("rejects an empty bearer token", async () => {
      const { error } = await run(middleware, {
        headers: { authorization: "Bearer " },
      });
      expectAuthError(error, ErrorType.TOKEN_MISSING);
    });

    it("rejects when cookies are not parsed", async () => {
      const { error } = await run(middleware, { cookies: undefined });
      expectAuthError(error, ErrorType.TOKEN_MISSING);
    });

    it("ignores non-bearer authorization schemes", async () => {
      const token = await signAccessToken({ sub: USER_ID, role });
      const { error } = await run(middleware, {
        headers: { authorization: `Basic ${token}` },
      });
      expectAuthError(error, ErrorType.TOKEN_MISSING);
    });

    it("accepts a valid bearer token and sets req.user", async () => {
      const token = await signAccessToken({ sub: USER_ID, role });
      const { req, next, error } = await run(middleware, {
        headers: bearer(token),
      });
      expect(error).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
      expect(req.user).toMatchObject({
        sub: USER_ID,
        role,
        iss: config.issuer,
        aud: config.audience,
      });
    });

    it("accepts a valid access token cookie", async () => {
      const token = await signAccessToken({ sub: USER_ID, role });
      const { req, next } = await run(middleware, {
        cookies: { accessToken: token },
      });
      expect(next).toHaveBeenCalled();
      expect(req.user?.sub).toBe(USER_ID);
    });

    it("prefers the bearer header over the cookie", async () => {
      const headerToken = await signAccessToken({ sub: USER_ID, role });
      const cookieToken = await signAccessToken({ sub: OTHER_USER_ID, role });
      const { req } = await run(middleware, {
        headers: bearer(headerToken),
        cookies: { accessToken: cookieToken },
      });
      expect(req.user?.sub).toBe(USER_ID);
    });

    it("rejects expired tokens with TOKEN_EXPIRED", async () => {
      const token = await signAccessToken({
        sub: USER_ID,
        role,
        expiresAt: expiredTimestamp(),
      });
      const { error, next } = await run(middleware, { headers: bearer(token) });
      expectAuthError(error, ErrorType.TOKEN_EXPIRED);
      expect(next).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalled();
    });

    it.each([
      ["signed with another secret", { secret: "x".repeat(48) }],
      ["with a wrong issuer", { issuer: "http://evil.test" }],
      ["with a wrong audience", { audience: "http://evil.test" }],
    ])("rejects tokens %s with TOKEN_INVALID", async (_label, opts) => {
      const token = await signAccessToken({ sub: USER_ID, role, ...opts });
      const { error, req } = await run(middleware, { headers: bearer(token) });
      expectAuthError(error, ErrorType.TOKEN_INVALID);
      expect(req.user).toBeUndefined();
    });

    it("rejects malformed tokens with TOKEN_INVALID", async () => {
      const { error } = await run(middleware, {
        headers: bearer("not.a.jwt"),
      });
      expectAuthError(error, ErrorType.TOKEN_INVALID);
    });

    it("rejects tokens using a disallowed algorithm", async () => {
      const { error } = await run(middleware, {
        headers: bearer(await hs512Token()),
      });
      expectAuthError(error, ErrorType.TOKEN_INVALID);
    });
  });
};

describe("requireLoggedin", () => {
  describeTokenVerification("requireLoggedin", requireLoggedin, "user");

  it("reports the missing bearer token message", async () => {
    const { error } = await run(requireLoggedin);
    expect((error as Error).message).toBe("Missing Bearer token");
  });

  it("reports invalid tokens with a generic message", async () => {
    const { error } = await run(requireLoggedin, { headers: bearer("x") });
    expect((error as Error).message).toBe("Invalid access token");
  });

  it("allows admins too", async () => {
    const token = await signAccessToken({ sub: USER_ID, role: "admin" });
    const { next } = await run(requireLoggedin, { headers: bearer(token) });
    expect(next).toHaveBeenCalled();
  });
});

describe("requireAdmin", () => {
  describeTokenVerification("requireAdmin", requireAdmin, "admin");

  it("reports the missing access token message", async () => {
    const { error } = await run(requireAdmin);
    expect((error as Error).message).toBe("Missing access token");
  });

  it("reports invalid tokens with a generic message", async () => {
    const { error } = await run(requireAdmin, { headers: bearer("x") });
    expect((error as Error).message).toBe("Invalid Bearer token");
  });

  it.each(["user", "superuser", "ADMIN"])(
    "rejects valid tokens with role %s",
    async (role) => {
      const token = await signAccessToken({ sub: USER_ID, role });
      const { error, next, req } = await run(requireAdmin, {
        headers: bearer(token),
      });
      expect(error).toBeInstanceOf(AuthorizationError);
      expect((error as AuthorizationError).code).toBe(
        ErrorType.INSUFFICIENT_ROLE,
      );
      expect(next).not.toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    },
  );
});

describe("requireSelfOrAdmin", () => {
  const userPayload = (sub?: string, role = "user") => ({
    sub,
    role,
    emailVerified: true,
  });

  it("calls next when the user requests their own resource", async () => {
    const { next, res, error } = await run(requireSelfOrAdmin, {
      params: { id: USER_ID },
      user: userPayload(USER_ID),
    });
    expect(error).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
    expect(res.sendStatus).not.toHaveBeenCalled();
  });

  it("throws TOKEN_MISSING when req.user is absent", async () => {
    const { error, next } = await run(requireSelfOrAdmin, {
      params: { id: USER_ID },
    });
    expectAuthError(error, ErrorType.TOKEN_MISSING);
    expect(next).not.toHaveBeenCalled();
  });

  it("throws TOKEN_MISSING when the user has no subject", async () => {
    const { error } = await run(requireSelfOrAdmin, {
      params: { id: USER_ID },
      user: userPayload(undefined),
    });
    expectAuthError(error, ErrorType.TOKEN_MISSING);
  });

  it("allows admins to access other users", async () => {
    const token = await signAccessToken({ sub: USER_ID, role: "admin" });
    const { next, error, req } = await run(requireSelfOrAdmin, {
      params: { id: OTHER_USER_ID },
      user: userPayload(USER_ID, "admin"),
      headers: bearer(token),
    });
    expect(error).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user?.role).toBe("admin");
  });

  it("forbids non-admins from accessing other users", async () => {
    const token = await signAccessToken({ sub: USER_ID, role: "user" });
    const { next, error } = await run(requireSelfOrAdmin, {
      params: { id: OTHER_USER_ID },
      user: userPayload(USER_ID),
      headers: bearer(token),
    });
    expect(error).toBeInstanceOf(AuthorizationError);
    expect(next).not.toHaveBeenCalled();
  });

  it("verifies the token rather than trusting req.user.role", async () => {
    const token = await signAccessToken({ sub: USER_ID, role: "user" });
    const { error } = await run(requireSelfOrAdmin, {
      params: { id: OTHER_USER_ID },
      user: userPayload(USER_ID, "admin"),
      headers: bearer(token),
    });
    expect(error).toBeInstanceOf(AuthorizationError);
  });

  it("responds 400 for a non-uuid id", async () => {
    const { res } = await run(requireSelfOrAdmin, {
      params: { id: "not-a-uuid" },
      user: userPayload("not-a-uuid"),
    });
    expect(res.sendStatus).toHaveBeenCalledWith(400);
  });

  it("does not stop the chain after responding 400 for a non-uuid id", async () => {
    const { res, next } = await run(requireSelfOrAdmin, {
      params: { id: "not-a-uuid" },
      user: userPayload("not-a-uuid"),
    });
    expect(res.sendStatus).toHaveBeenCalledWith(400);
    expect(next).toHaveBeenCalled();
  });
});
