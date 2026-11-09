import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tokenRequestRateLimiter } from "@/feature/auth/middleware/rateLimiter";
import { AuthRouter } from "@/feature/auth/routing/authRouter";
import type { AuthenticationService } from "@/feature/auth/service/authenticationService";
import {
  STRONG_PASSWORD,
  TEST_USER,
  fakeAuthService,
  startAuthServer,
  type FakeAuthService,
} from "#test/helpers/auth";
import type { TestServer } from "#test/helpers/http";

// See webAuthRouter.test.ts: limiters pass through and are only checked for wiring.
vi.mock("@/feature/auth/middleware/rateLimiter", () => {
  const pass = () => vi.fn((_req: unknown, _res: unknown, next: () => void) => next());
  return {
    passwordGrantLimiter: [pass()],
    refreshGrantLimiter: pass(),
    resetPasswordRateLimiter: pass(),
    tokenRequestRateLimiter: [pass()],
  };
});

const BASE = "/api/auth";

describe("AuthRouter", () => {
  let service: FakeAuthService;
  let server: TestServer;

  beforeEach(async () => {
    service = fakeAuthService();
    server = await startAuthServer(
      new AuthRouter(service as unknown as AuthenticationService).setup(),
    );
  });

  afterEach(async () => {
    await server.close();
  });

  describe("sub-routers", () => {
    it("mounts the web router under /web", async () => {
      const res = await server.post(`${BASE}/web/login`, {
        email: TEST_USER.email,
        password: STRONG_PASSWORD,
      });
      expect(res.status).toBe(200);
      expect(res.headers.getSetCookie().length).toBeGreaterThan(0);
    });

    it("mounts the mobile router under /mobile", async () => {
      const res = await server.post(`${BASE}/mobile/login`, {
        email: TEST_USER.email,
        password: STRONG_PASSWORD,
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toHaveProperty("accessToken");
    });
  });

  describe.each([
    ["/resetPasswordToken", "requestPasswordResetToken"],
    ["/requestEmailVerification", "requestEmailVerification"],
  ] as const)("POST %s", (path, method) => {
    it("returns 204 and asks the service to send the email", async () => {
      const res = await server.post(`${BASE}${path}`, { email: TEST_USER.email });
      expect(res.status).toBe(204);
      expect(service[method]).toHaveBeenCalledWith(TEST_USER.email);
    });

    it("returns the same 204 whether or not the account exists", async () => {
      // The service resolves silently for unknown emails; the route must not
      // add anything that distinguishes the two.
      const known = await server.post(`${BASE}${path}`, { email: TEST_USER.email });
      const unknown = await server.post(`${BASE}${path}`, { email: "nobody@example.com" });
      expect(unknown.status).toBe(known.status);
      expect(await unknown.text()).toBe(await known.text());
    });

    it.each([
      ["an invalid email", { email: "nope" }],
      ["a missing email", {}],
      ["a non-string email", { email: ["a@b.co"] }],
    ])("rejects %s with a 400", async (_label, body) => {
      const res = await server.post(`${BASE}${path}`, body);
      expect(res.status).toBe(400);
      expect(service[method]).not.toHaveBeenCalled();
    });

    it("applies the token request limiter", async () => {
      await server.post(`${BASE}${path}`, { email: TEST_USER.email });
      expect(tokenRequestRateLimiter[0]).toHaveBeenCalledOnce();
    });
  });

  describe("POST /validateEmail", () => {
    const TOKEN = "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d";

    it("validates the token from the query string", async () => {
      const res = await server.post(`${BASE}/validateEmail?token=${TOKEN}`);
      expect(res.status).toBe(204);
      expect(service.validateEmail).toHaveBeenCalledWith(TOKEN);
    });

    it("returns 404 when the token was not consumed", async () => {
      service.validateEmail.mockResolvedValue(false);
      const res = await server.post(`${BASE}/validateEmail?token=${TOKEN}`);
      expect(res.status).toBe(404);
    });

    it.each([
      ["a missing token", ""],
      ["an empty token", "?token="],
      ["a repeated token parameter", `?token=${TOKEN}&token=${TOKEN}`],
      ["a non-uuid token", "?token=abc"],
    ])("rejects %s with a 400", async (_label, query) => {
      const res = await server.post(`${BASE}/validateEmail${query}`);
      expect(res.status).toBe(400);
      expect(service.validateEmail).not.toHaveBeenCalled();
    });
  });
});
