import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorType } from "@/core/errors/errorTypes";
import { AuthenticationError } from "@/feature/auth/errors/authenticationError";
import { AuthorizationError } from "@/feature/auth/errors/authorizationError";
import {
  passwordGrantLimiter,
  refreshGrantLimiter,
  resetPasswordRateLimiter,
} from "@/feature/auth/middleware/rateLimiter";
import { MobileAuthRouter } from "@/feature/auth/routing/mobile/mobileAuthrouter";
import type { AuthenticationService } from "@/feature/auth/service/authenticationService";
import {
  RESET_TOKEN,
  STRONG_PASSWORD,
  TEST_USER,
  fakeAuthService,
  setCookies,
  startAuthServer,
  type FakeAuthService,
} from "#test/helpers/auth";
import type { TestServer } from "#test/helpers/http";
import { expectLimiterApplied } from "#test/helpers/rateLimiter";

// See webAuthRouter.test.ts: limiters pass through and are only checked for wiring.
vi.mock("@/feature/auth/middleware/rateLimiter", async (importOriginal) => {
  const { passThroughLimiters } = await import("#test/helpers/rateLimiter");
  return passThroughLimiters(await importOriginal());
});

const BASE = "/api/auth/mobile";

describe("MobileAuthRouter", () => {
  let service: FakeAuthService;
  let server: TestServer;

  beforeEach(async () => {
    service = fakeAuthService();
    server = await startAuthServer(
      MobileAuthRouter(service as unknown as AuthenticationService),
      "/auth/mobile",
    );
  });

  afterEach(async () => {
    await server.close();
  });

  describe("POST /login", () => {
    const body = { email: TEST_USER.email, password: STRONG_PASSWORD };

    it("returns the tokens and user in the body, without cookies", async () => {
      const res = await server.post(`${BASE}/login`, body);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        accessToken: "new-access",
        refreshToken: "new-refresh",
        user: TEST_USER,
      });
      expect(service.verify).toHaveBeenCalledWith(TEST_USER.email, STRONG_PASSWORD);
      expect(service.getNewTokenSet).toHaveBeenCalledWith(TEST_USER.id);
      expect(setCookies(res)).toEqual({});
    });

    it.each([
      ["a refresh token body", { refreshToken: "rt" }],
      ["a missing password", { email: TEST_USER.email }],
      ["no body", undefined],
    ])("rejects %s with a 400", async (_label, badBody) => {
      const res = await server.post(`${BASE}/login`, badBody);
      expect(res.status).toBe(400);
      expect(service.verify).not.toHaveBeenCalled();
    });

    it("returns 401 for bad credentials", async () => {
      service.verify.mockRejectedValue(new AuthenticationError("Incorrect Email or Password"));
      const res = await server.post(`${BASE}/login`, body);
      expect(res.status).toBe(401);
      expect(service.getNewTokenSet).not.toHaveBeenCalled();
    });

    it("returns 403 unverified_email for an unverified account", async () => {
      service.verify.mockRejectedValue(
        new AuthorizationError("Email not verified", { type: ErrorType.UNVERIFIED_EMAIL }),
      );
      const res = await server.post(`${BASE}/login`, body);
      expect(res.status).toBe(403);
      expect((await res.json()).error).toBe(ErrorType.UNVERIFIED_EMAIL);
    });

    it("applies the password grant limiter", async () => {
      await server.post(`${BASE}/login`, body);
      expectLimiterApplied(passwordGrantLimiter);
    });
  });

  describe("POST /logout", () => {
    it("revokes the refresh token from the body", async () => {
      const res = await server.post(`${BASE}/logout`, { refreshToken: "old-refresh" });
      expect(res.status).toBe(204);
      expect(service.clearRefreshToken).toHaveBeenCalledWith("old-refresh");
    });

    it.each([
      ["no body", undefined],
      ["an empty body", {}],
      ["a non-string token", { refreshToken: 5 }],
      ["an empty token", { refreshToken: "" }],
    ])("returns 204 without revoking anything for %s", async (_label, body) => {
      const res = await server.post(`${BASE}/logout`, body);
      expect(res.status).toBe(204);
      expect(service.clearRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe("POST /register", () => {
    const body = {
      email: TEST_USER.email,
      username: TEST_USER.username,
      password: STRONG_PASSWORD,
      tosAcknowledged: true,
    };

    it("returns the user and tokens in the body, without cookies", async () => {
      const res = await server.post(`${BASE}/register`, body);
      expect(res.status).toBe(201);
      expect(await res.json()).toEqual({
        user: {
          id: TEST_USER.id,
          email: TEST_USER.email,
          username: TEST_USER.username,
          emailVerified: false,
          role: "user",
        },
        accessToken: "new-access",
        refreshToken: "new-refresh",
      });
      expect(service.registerUser).toHaveBeenCalledWith(body);
      expect(setCookies(res)).toEqual({});
    });

    it("rejects an invalid body before registering", async () => {
      const res = await server.post(`${BASE}/register`, { ...body, tosAcknowledged: "yes" });
      expect(res.status).toBe(400);
      expect(service.registerUser).not.toHaveBeenCalled();
    });

    it("applies the password grant limiter", async () => {
      await server.post(`${BASE}/register`, body);
      expectLimiterApplied(passwordGrantLimiter);
    });
  });

  describe("POST /refresh", () => {
    const body = { refreshToken: "old-refresh" };

    it("returns rotated tokens in the body", async () => {
      const res = await server.post(`${BASE}/refresh`, body);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        accessToken: "rotated-access",
        refreshToken: "rotated-refresh",
      });
      expect(service.refreshAccessToken).toHaveBeenCalledWith("old-refresh");
      expect(setCookies(res)).toEqual({});
    });

    it.each([
      ["a login body", { email: TEST_USER.email, password: STRONG_PASSWORD }],
      ["an empty token", { refreshToken: "" }],
      ["a non-string token", { refreshToken: 5 }],
      ["no body", undefined],
    ])("rejects %s with a 400", async (_label, badBody) => {
      const res = await server.post(`${BASE}/refresh`, badBody);
      expect(res.status).toBe(400);
      expect(service.refreshAccessToken).not.toHaveBeenCalled();
    });

    it("returns 401 when the token is rejected", async () => {
      service.refreshAccessToken.mockRejectedValue(
        new AuthenticationError("revoked", { type: ErrorType.TOKEN_REVOKED }),
      );
      const res = await server.post(`${BASE}/refresh`, body);
      expect(res.status).toBe(401);
      expect((await res.json()).error).toBe(ErrorType.TOKEN_REVOKED);
    });

    it("applies the refresh grant limiter", async () => {
      await server.post(`${BASE}/refresh`, body);
      expectLimiterApplied(refreshGrantLimiter);
    });
  });

  describe("POST /resetPassword", () => {
    const body = { token: RESET_TOKEN, password: STRONG_PASSWORD };

    it("resets the password without touching cookies", async () => {
      const res = await server.post(`${BASE}/resetPassword`, body);
      expect(res.status).toBe(200);
      expect(service.resetPassword).toHaveBeenCalledWith(RESET_TOKEN, STRONG_PASSWORD);
      expect(setCookies(res)).toEqual({});
    });

    it.each([
      ["a weak password", { ...body, password: "weak" }],
      ["a non-uuid token", { ...body, token: "abc" }],
    ])("rejects %s with a 400", async (_label, badBody) => {
      const res = await server.post(`${BASE}/resetPassword`, badBody);
      expect(res.status).toBe(400);
      expect(service.resetPassword).not.toHaveBeenCalled();
    });

    it("applies the reset password limiter", async () => {
      await server.post(`${BASE}/resetPassword`, body);
      expectLimiterApplied(resetPasswordRateLimiter);
    });
  });
});
