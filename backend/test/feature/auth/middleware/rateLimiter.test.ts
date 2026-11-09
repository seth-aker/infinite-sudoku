import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import { startServer, type TestServer } from "#test/helpers/http";

const PER_IP_AND_EMAIL_LIMIT = 5;
const PER_IP_LIMIT = 20;
const PER_EMAIL_LIMIT = 50;
const REFRESH_LIMIT = 5;
const RESET_LIMIT = 3;
const TOKEN_REQUEST_PER_IP_AND_EMAIL_LIMIT = 3;
const TOKEN_REQUEST_PER_IP_LIMIT = 10;
const TOKEN_REQUEST_PER_EMAIL_LIMIT = 5;

const IP = "203.0.113.1";
const OTHER_IP = "198.51.100.1";
// A distinct IP per index, for spreading attempts across many clients.
const ipN = (n: number) => `10.0.${Math.floor(n / 250)}.${(n % 250) + 1}`;

describe("auth rate limiters", () => {
  let server: TestServer;

  // The limiters keep their counts in module-level memory stores, so each test
  // gets a fresh copy of the module.
  beforeEach(async () => {
    vi.resetModules();
    const {
      passwordGrantLimiter,
      refreshGrantLimiter,
      resetPasswordRateLimiter,
      tokenRequestRateLimiter,
    } =
      await import("@/feature/auth/middleware/rateLimiter");

    const app = express();
    app.set("trust proxy", true); // lets tests pick the client IP via X-Forwarded-For
    app.use(express.json());
    app.use(cookieParser());
    // Fails unless the body says otherwise, because only failed requests count
    // (skipSuccessfulRequests).
    const handler: express.RequestHandler = (req, res) => {
      res.sendStatus(req.body?.succeed ? 200 : 401);
    };
    app.post("/login", passwordGrantLimiter, handler);
    app.post("/refresh", refreshGrantLimiter, handler);
    app.post("/reset", resetPasswordRateLimiter, handler);
    app.post("/token-request", tokenRequestRateLimiter, handler);
    server = await startServer(app);
  });

  afterEach(async () => {
    await server.close();
  });

  function send(path: string, body: object, ip = IP, headers: Record<string, string> = {}) {
    return server.post(path, body, { "x-forwarded-for": ip, ...headers });
  }

  async function status(path: string, body: object, ip = IP, headers?: Record<string, string>) {
    return (await send(path, body, ip, headers)).status;
  }

  async function fail(path: string, body: object, times: number, ip = IP, headers?: Record<string, string>) {
    for (let i = 0; i < times; i++) {
      expect(await status(path, body, ip, headers)).toBe(401);
    }
  }

  describe("passwordGrantLimiter", () => {
    const login = (email?: unknown) => ({ email });

    describe("per IP and email", () => {
      it(`blocks an email from one IP after ${PER_IP_AND_EMAIL_LIMIT} failures`, async () => {
        await fail("/login", login("a@b.co"), PER_IP_AND_EMAIL_LIMIT);
        expect(await status("/login", login("a@b.co"))).toBe(429);
      });

      it("does not lock the account out for other IPs", async () => {
        await fail("/login", login("a@b.co"), PER_IP_AND_EMAIL_LIMIT);
        expect(await status("/login", login("a@b.co"), OTHER_IP)).toBe(401);
      });

      it("does not block other emails from the same IP", async () => {
        await fail("/login", login("a@b.co"), PER_IP_AND_EMAIL_LIMIT);
        expect(await status("/login", login("other@b.co"))).toBe(401);
      });

      it("ignores email case and surrounding whitespace", async () => {
        await fail("/login", login("  User@Example.com "), PER_IP_AND_EMAIL_LIMIT);
        expect(await status("/login", login("user@example.COM"))).toBe(429);
      });

      it("groups requests without an email by IP", async () => {
        await fail("/login", {}, PER_IP_AND_EMAIL_LIMIT);
        expect(await status("/login", {})).toBe(429);
        expect(await status("/login", {}, OTHER_IP)).toBe(401);
      });
    });

    describe("per IP", () => {
      it(`blocks an IP after ${PER_IP_LIMIT} failures across different emails`, async () => {
        for (let i = 0; i < PER_IP_LIMIT; i++) {
          expect(await status("/login", login(`user${i}@b.co`))).toBe(401);
        }
        expect(await status("/login", login("fresh@b.co"))).toBe(429);
        expect(await status("/login", login("fresh@b.co"), OTHER_IP)).toBe(401);
      });
    });

    describe("per email", () => {
      it(`blocks an email after ${PER_EMAIL_LIMIT} failures across different IPs`, async () => {
        for (let i = 0; i < PER_EMAIL_LIMIT; i++) {
          expect(await status("/login", login("a@b.co"), ipN(i))).toBe(401);
        }
        expect(await status("/login", login("a@b.co"), OTHER_IP)).toBe(429);
        expect(await status("/login", login("other@b.co"), OTHER_IP)).toBe(401);
      });
    });

    it("does not count successful requests", async () => {
      for (let i = 0; i < PER_IP_AND_EMAIL_LIMIT * 2; i++) {
        expect(await status("/login", { ...login("a@b.co"), succeed: true })).toBe(200);
      }
      await fail("/login", login("a@b.co"), PER_IP_AND_EMAIL_LIMIT);
    });

    it.each([
      ["a number", 123],
      ["an array", ["a@b.co"]],
      ["an object", { $ne: null }],
    ])("treats an email that is %s as missing instead of crashing", async (_label, email) => {
      await fail("/login", login(email), PER_IP_AND_EMAIL_LIMIT);
      // Shares the no-email bucket for this IP.
      expect(await status("/login", {})).toBe(429);
    });

    it("sends a Retry-After header when blocking", async () => {
      await fail("/login", login("a@b.co"), PER_IP_AND_EMAIL_LIMIT);
      const res = await send("/login", login("a@b.co"));
      expect(res.status).toBe(429);
      expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
    });
  });

  describe("refreshGrantLimiter", () => {
    const cookie = (token: string) => ({ cookie: `refreshToken=${token}` });

    it(`blocks a body refresh token after ${REFRESH_LIMIT} failures (mobile)`, async () => {
      await fail("/refresh", { refreshToken: "token-1" }, REFRESH_LIMIT);
      expect(await status("/refresh", { refreshToken: "token-1" }, OTHER_IP)).toBe(429);
      expect(await status("/refresh", { refreshToken: "token-2" })).toBe(401);
    });

    it(`blocks a cookie refresh token after ${REFRESH_LIMIT} failures (web)`, async () => {
      await fail("/refresh", {}, REFRESH_LIMIT, IP, cookie("token-1"));
      expect(await status("/refresh", {}, OTHER_IP, cookie("token-1"))).toBe(429);
    });

    it("does not block other users behind the same IP (web)", async () => {
      await fail("/refresh", {}, REFRESH_LIMIT, IP, cookie("token-1"));
      expect(await status("/refresh", {}, IP, cookie("token-2"))).toBe(401);
    });

    it("prefers the body token over the cookie", async () => {
      await fail("/refresh", { refreshToken: "body-token" }, REFRESH_LIMIT, IP, cookie("cookie-token"));
      expect(await status("/refresh", { refreshToken: "body-token" })).toBe(429);
      expect(await status("/refresh", {}, IP, cookie("cookie-token"))).toBe(401);
    });

    it("groups requests without a token by IP", async () => {
      await fail("/refresh", {}, REFRESH_LIMIT);
      expect(await status("/refresh", {})).toBe(429);
      expect(await status("/refresh", {}, OTHER_IP)).toBe(401);
    });

    it.each([
      ["a number", 5],
      ["an array", ["token"]],
      ["empty", ""],
    ])("treats a token that is %s as missing instead of crashing", async (_label, refreshToken) => {
      await fail("/refresh", { refreshToken }, REFRESH_LIMIT);
      expect(await status("/refresh", {})).toBe(429);
    });

    it("keeps its counts separate from the login limiter", async () => {
      await fail("/login", {}, PER_IP_AND_EMAIL_LIMIT);
      expect(await status("/refresh", {})).toBe(401);
    });

    it("does not count successful requests", async () => {
      for (let i = 0; i < REFRESH_LIMIT * 2; i++) {
        expect(await status("/refresh", { refreshToken: "t", succeed: true })).toBe(200);
      }
    });
  });

  describe("resetPasswordRateLimiter", () => {
    const reset = (token?: unknown) => ({ token, password: "Str0ng!pass" });

    it(`blocks a reset token after ${RESET_LIMIT} failures, from any IP`, async () => {
      await fail("/reset", reset("token-1"), RESET_LIMIT);
      expect(await status("/reset", reset("token-1"), OTHER_IP)).toBe(429);
      expect(await status("/reset", reset("token-2"))).toBe(401);
    });

    it("groups requests without a token by IP", async () => {
      await fail("/reset", reset(), RESET_LIMIT);
      expect(await status("/reset", reset())).toBe(429);
      expect(await status("/reset", reset(), OTHER_IP)).toBe(401);
    });

    it.each([
      ["a number", 5],
      ["an array", ["token"]],
      ["empty", ""],
    ])("treats a token that is %s as missing instead of crashing", async (_label, token) => {
      await fail("/reset", reset(token), RESET_LIMIT);
      expect(await status("/reset", reset())).toBe(429);
    });

    it("keeps its counts separate from the login limiter", async () => {
      await fail("/login", {}, PER_IP_AND_EMAIL_LIMIT);
      expect(await status("/reset", reset())).toBe(401);
    });

    it("does not count successful requests", async () => {
      for (let i = 0; i < RESET_LIMIT * 2; i++) {
        expect(await status("/reset", { ...reset("t"), succeed: true })).toBe(200);
      }
    });
  });
  describe("tokenRequestRateLimiter", () => {
    // Sends emails, so every request counts, not just failures.
    const request = (email?: unknown, succeed = true) => ({ email, succeed });
    const ok = async (body: object, times: number, ip = IP) => {
      for (let i = 0; i < times; i++) {
        expect(await status("/token-request", body, ip)).toBe(200);
      }
    };

    it(`blocks an email from one IP after ${TOKEN_REQUEST_PER_IP_AND_EMAIL_LIMIT} requests, even successful ones`, async () => {
      await ok(request("a@b.co"), TOKEN_REQUEST_PER_IP_AND_EMAIL_LIMIT);
      expect(await status("/token-request", request("a@b.co"))).toBe(429);
    });

    it("counts failed requests too", async () => {
      await fail("/token-request", request("a@b.co", false), TOKEN_REQUEST_PER_IP_AND_EMAIL_LIMIT);
      expect(await status("/token-request", request("a@b.co"))).toBe(429);
    });

    it("does not block the same email from another IP or other emails from the same IP", async () => {
      await ok(request("a@b.co"), TOKEN_REQUEST_PER_IP_AND_EMAIL_LIMIT);
      expect(await status("/token-request", request("a@b.co"), OTHER_IP)).toBe(200);
      expect(await status("/token-request", request("other@b.co"))).toBe(200);
    });

    it("ignores email case and surrounding whitespace", async () => {
      await ok(request(" User@Example.com "), TOKEN_REQUEST_PER_IP_AND_EMAIL_LIMIT);
      expect(await status("/token-request", request("user@example.COM"))).toBe(429);
    });

    it(`blocks an IP after ${TOKEN_REQUEST_PER_IP_LIMIT} requests across different emails`, async () => {
      for (let i = 0; i < TOKEN_REQUEST_PER_IP_LIMIT; i++) {
        expect(await status("/token-request", request(`user${i}@b.co`))).toBe(200);
      }
      expect(await status("/token-request", request("fresh@b.co"))).toBe(429);
      expect(await status("/token-request", request("fresh@b.co"), OTHER_IP)).toBe(200);
    });

    it(`blocks an email after ${TOKEN_REQUEST_PER_EMAIL_LIMIT} requests across different IPs`, async () => {
      for (let i = 0; i < TOKEN_REQUEST_PER_EMAIL_LIMIT; i++) {
        expect(await status("/token-request", request("a@b.co"), ipN(i))).toBe(200);
      }
      expect(await status("/token-request", request("a@b.co"), OTHER_IP)).toBe(429);
      expect(await status("/token-request", request("other@b.co"), OTHER_IP)).toBe(200);
    });

    it.each([
      ["missing", undefined],
      ["a number", 123],
      ["an array", ["a@b.co"]],
    ])("groups requests whose email is %s by IP instead of crashing", async (_label, email) => {
      await ok(request(email), TOKEN_REQUEST_PER_IP_AND_EMAIL_LIMIT);
      expect(await status("/token-request", request())).toBe(429);
      expect(await status("/token-request", request(), OTHER_IP)).toBe(200);
    });

    it("keeps its counts separate from the login limiter", async () => {
      await fail("/login", { email: "a@b.co" }, PER_IP_AND_EMAIL_LIMIT);
      expect(await status("/token-request", request("a@b.co"))).toBe(200);
    });
  });
});
