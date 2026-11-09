import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError } from "@/core/errors/conflictError";
import { ErrorType } from "@/core/errors/errorTypes";
import { NotFoundError } from "@/core/errors/notFoundError";
import { AuthenticationError } from "@/feature/auth/errors/authenticationError";
import {
  passwordGrantLimiter,
  refreshGrantLimiter,
  resetPasswordRateLimiter,
} from "@/feature/auth/middleware/rateLimiter";
import { WebAuthRouter } from "@/feature/auth/routing/web/webAuthRouter";
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

// The limiters are covered in rateLimiter.test.ts. Here they pass through, so
// their shared in-memory counts can't leak between tests, and we only check
// that each route applies the right one.
vi.mock("@/feature/auth/middleware/rateLimiter", () => {
  const pass = () => vi.fn((_req: unknown, _res: unknown, next: () => void) => next());
  return {
    passwordGrantLimiter: [pass()],
    refreshGrantLimiter: pass(),
    resetPasswordRateLimiter: pass(),
    tokenRequestRateLimiter: [pass()],
  };
});

const BASE = "/api/auth/web";

describe("WebAuthRouter", () => {
  let service: FakeAuthService;
  let server: TestServer;

  beforeEach(async () => {
    service = fakeAuthService();
    server = await startAuthServer(
      WebAuthRouter(service as unknown as AuthenticationService),
      "/auth/web",
    );
  });

  afterEach(async () => {
    await server.close();
  });

  const withCookie = (cookie: string) => ({ cookie });

  describe("POST /login", () => {
    const body = { email: TEST_USER.email, password: STRONG_PASSWORD };

    it("returns the user and sets the auth cookies", async () => {
      const res = await server.post(`${BASE}/login`, body);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ user: TEST_USER });
      expect(service.verify).toHaveBeenCalledWith(TEST_USER.email, STRONG_PASSWORD);
      expect(service.getNewTokenSet).toHaveBeenCalledWith(TEST_USER.id);
      const cookies = setCookies(res);
      expect(cookies.accessToken?.value).toBe("new-access");
      expect(cookies.refreshToken?.value).toBe("new-refresh");
    });

    it("keeps the tokens out of the response body", async () => {
      const res = await server.post(`${BASE}/login`, body);
      const text = await res.text();
      expect(text).not.toContain("new-access");
      expect(text).not.toContain("new-refresh");
    });

    it("rejects an invalid body before checking credentials", async () => {
      const res = await server.post(`${BASE}/login`, { email: "nope" });
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe(ErrorType.VALIDATION_FAILED);
      expect(service.verify).not.toHaveBeenCalled();
    });

    it("returns 401 without cookies for bad credentials", async () => {
      service.verify.mockRejectedValue(new AuthenticationError("Incorrect Email or Password"));
      const res = await server.post(`${BASE}/login`, body);
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({
        error: ErrorType.INVALID_CREDENTIALS,
        message: "Incorrect Email or Password",
      });
      expect(service.getNewTokenSet).not.toHaveBeenCalled();
      expect(setCookies(res)).toEqual({});
    });

    it("applies the password grant limiter", async () => {
      await server.post(`${BASE}/login`, body);
      expect(passwordGrantLimiter[0]).toHaveBeenCalledOnce();
    });
  });

  describe("POST /logout", () => {
    it("revokes the refresh token and clears the cookies", async () => {
      const res = await server.request(`${BASE}/logout`, {
        method: "POST",
        headers: withCookie("refreshToken=old-refresh; accessToken=old-access"),
      });
      expect(res.status).toBe(204);
      expect(service.clearRefreshToken).toHaveBeenCalledWith("old-refresh");
      const cookies = setCookies(res);
      expect(cookies.accessToken).toEqual({ value: "", expired: true });
      expect(cookies.refreshToken).toEqual({ value: "", expired: true });
    });

    it("works without an access token, so expired sessions can still log out", async () => {
      const res = await server.request(`${BASE}/logout`, {
        method: "POST",
        headers: withCookie("refreshToken=old-refresh"),
      });
      expect(res.status).toBe(204);
      expect(service.clearRefreshToken).toHaveBeenCalledWith("old-refresh");
    });

    it("still clears the cookies when there is no refresh token", async () => {
      const res = await server.request(`${BASE}/logout`, { method: "POST" });
      expect(res.status).toBe(204);
      expect(service.clearRefreshToken).not.toHaveBeenCalled();
      expect(setCookies(res).accessToken?.expired).toBe(true);
    });
  });

  describe("POST /register", () => {
    const body = {
      email: TEST_USER.email,
      username: TEST_USER.username,
      password: STRONG_PASSWORD,
      tosAcknowledged: true,
    };

    it("creates the user, returns it and sets the auth cookies", async () => {
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
      });
      expect(service.registerUser).toHaveBeenCalledWith(body);
      const cookies = setCookies(res);
      expect(cookies.accessToken?.value).toBe("new-access");
      expect(cookies.refreshToken?.value).toBe("new-refresh");
    });

    it("rejects a weak password before registering", async () => {
      const res = await server.post(`${BASE}/register`, { ...body, password: "weak" });
      expect(res.status).toBe(400);
      expect(service.registerUser).not.toHaveBeenCalled();
    });

    it("returns 409 when the user already exists", async () => {
      service.registerUser.mockRejectedValue(
        new ConflictError("Duplicate value violates users_email_key", {
          clientMessage: "A record with this value already exists",
        }),
      );
      const res = await server.post(`${BASE}/register`, body);
      expect(res.status).toBe(409);
      expect(setCookies(res)).toEqual({});
    });

    it("applies the password grant limiter", async () => {
      await server.post(`${BASE}/register`, body);
      expect(passwordGrantLimiter[0]).toHaveBeenCalledOnce();
    });
  });

  describe("POST /refresh", () => {
    const refresh = (cookie?: string) =>
      server.request(`${BASE}/refresh`, {
        method: "POST",
        headers: cookie ? withCookie(cookie) : {},
      });

    it("rotates the refresh cookie and sets new auth cookies", async () => {
      const res = await refresh("refreshToken=old-refresh");
      expect(res.status).toBe(200);
      expect(service.refreshAccessToken).toHaveBeenCalledWith("old-refresh");
      const cookies = setCookies(res);
      expect(cookies.accessToken?.value).toBe("rotated-access");
      expect(cookies.refreshToken?.value).toBe("rotated-refresh");
    });

    it("returns 401 token_missing without a refresh cookie", async () => {
      const res = await refresh();
      expect(res.status).toBe(401);
      expect((await res.json()).error).toBe(ErrorType.TOKEN_MISSING);
      expect(service.refreshAccessToken).not.toHaveBeenCalled();
    });

    it("returns 401 without new cookies when the token is rejected", async () => {
      service.refreshAccessToken.mockRejectedValue(
        new AuthenticationError("revoked", { type: ErrorType.TOKEN_REVOKED }),
      );
      const res = await refresh("refreshToken=old-refresh");
      expect(res.status).toBe(401);
      expect((await res.json()).error).toBe(ErrorType.TOKEN_REVOKED);
      expect(setCookies(res)).toEqual({});
    });

    it("applies the refresh grant limiter", async () => {
      await refresh("refreshToken=old-refresh");
      expect(refreshGrantLimiter).toHaveBeenCalledOnce();
    });
  });

  describe("POST /resetPassword", () => {
    const body = { token: RESET_TOKEN, password: STRONG_PASSWORD };

    it("resets the password and clears the auth cookies", async () => {
      const res = await server.post(`${BASE}/resetPassword`, body);
      expect(res.status).toBe(200);
      expect(service.resetPassword).toHaveBeenCalledWith(RESET_TOKEN, STRONG_PASSWORD);
      const cookies = setCookies(res);
      expect(cookies.accessToken?.expired).toBe(true);
      expect(cookies.refreshToken?.expired).toBe(true);
    });

    it.each([
      ["a weak password", { ...body, password: "weak" }],
      ["a non-uuid token", { ...body, token: "abc" }],
      ["a missing token", { password: STRONG_PASSWORD }],
    ])("rejects %s with a 400", async (_label, badBody) => {
      const res = await server.post(`${BASE}/resetPassword`, badBody);
      expect(res.status).toBe(400);
      expect(service.resetPassword).not.toHaveBeenCalled();
    });

    it("passes service errors through", async () => {
      service.resetPassword.mockRejectedValue(
        new NotFoundError("Invalid token", { type: ErrorType.TOKEN_INVALID }),
      );
      const res = await server.post(`${BASE}/resetPassword`, body);
      expect(res.status).toBe(404);
      expect((await res.json()).error).toBe(ErrorType.TOKEN_INVALID);
    });

    it("applies the reset password limiter", async () => {
      await server.post(`${BASE}/resetPassword`, body);
      expect(resetPasswordRateLimiter).toHaveBeenCalledOnce();
    });
  });
});
