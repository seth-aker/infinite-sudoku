import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthenticationService } from "@/feature/auth/service/authenticationService";
import {
  RESET_TOKEN,
  STRONG_PASSWORD,
  TEST_USER,
  fakeAuthService,
  type FakeAuthService,
} from "#test/helpers/auth";
import { startServer, type TestServer } from "#test/helpers/http";

// The router tests mock the limiters out. This checks the real limiters are
// actually wired into the real routes: hammer each route and expect a 429.
// The exact limits are covered in rateLimiter.test.ts, so this only asks that
// the route is limited at all within a generous number of attempts.
const MAX_ATTEMPTS = 25;

const login = { email: TEST_USER.email, password: STRONG_PASSWORD };
const register = { ...login, username: TEST_USER.username, tosAcknowledged: true };
const reset = { token: RESET_TOKEN, password: STRONG_PASSWORD };

type Route = {
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  /** Makes the service fail, for limiters that only count failed requests. */
  fail?: (service: FakeAuthService) => void;
};

const nope = () => Promise.reject(new Error("nope"));

const ROUTES: [string, Route][] = [
  ["web login", { path: "/web/login", body: login, fail: (s) => s.verify.mockImplementation(nope) }],
  ["mobile login", { path: "/mobile/login", body: login, fail: (s) => s.verify.mockImplementation(nope) }],
  ["web register", { path: "/web/register", body: register, fail: (s) => s.registerUser.mockImplementation(nope) }],
  ["mobile register", { path: "/mobile/register", body: register, fail: (s) => s.registerUser.mockImplementation(nope) }],
  [
    "web refresh",
    {
      path: "/web/refresh",
      headers: { cookie: "refreshToken=old-refresh" },
      fail: (s) => s.refreshAccessToken.mockImplementation(nope),
    },
  ],
  [
    "mobile refresh",
    {
      path: "/mobile/refresh",
      body: { refreshToken: "old-refresh" },
      fail: (s) => s.refreshAccessToken.mockImplementation(nope),
    },
  ],
  ["web reset password", { path: "/web/resetPassword", body: reset, fail: (s) => s.resetPassword.mockImplementation(nope) }],
  ["mobile reset password", { path: "/mobile/resetPassword", body: reset, fail: (s) => s.resetPassword.mockImplementation(nope) }],
  // These send emails, so every request counts, successful or not.
  ["reset password token request", { path: "/resetPasswordToken", body: { email: TEST_USER.email } }],
  ["email verification request", { path: "/requestEmailVerification", body: { email: TEST_USER.email } }],
];

describe("auth route rate limiting", () => {
  let service: FakeAuthService;
  let server: TestServer;

  // The limiters keep their counts in module-level memory, so each test loads
  // fresh copies of the app and router (together, so error classes match).
  beforeEach(async () => {
    vi.resetModules();
    const { createApp } = await import("@/app");
    const { config } = await import("@/core/config");
    const { AuthRouter } = await import("@/feature/auth/routing/authRouter");
    service = fakeAuthService();
    const router = new AuthRouter(service as unknown as AuthenticationService).setup();
    server = await startServer(
      createApp({ config: { ...config, isProduction: false }, routers: [{ path: "/auth", router }] }),
    );
  });

  afterEach(async () => {
    await server.close();
  });

  it.each(ROUTES)("limits %s", async (_label, { path, body, headers, fail }) => {
    fail?.(service);
    const statuses: number[] = [];
    for (let i = 0; i < MAX_ATTEMPTS && !statuses.includes(429); i++) {
      statuses.push((await server.post(`/api/auth${path}`, body, headers)).status);
    }
    expect(statuses).toContain(429);
    // The requests before the block got through to the route.
    expect(statuses[0]).not.toBe(429);
  });
});
