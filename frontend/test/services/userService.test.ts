import { beforeEach, describe, expect, it, vi } from "vitest";
import { config } from "@/config";
import * as baseService from "@/services/baseService";
import * as userService from "@/services/userService";
import type { UserDto } from "@/services/userService";

// Only the network boundary is mocked, so these tests pin down the exact
// requests the backend receives. useAuth.test.ts mocks this whole module, so
// nothing else would notice a renamed field or a changed URL.
vi.mock("@/services/baseService", () => ({
  safeFetch: vi.fn(),
}));

const safeFetch = vi.mocked(baseService.safeFetch);
const BASE_URL = config.API_BASE_URL;
const JSON_HEADERS = { "Content-Type": "application/json" };

const EMAIL = "player@example.com";
const PASSWORD = "Secret123!";
const USERNAME = "player1";
const TOKEN = "0b3c8f4e-6a1d-4c2b-9e7f-1a2b3c4d5e6f";

const USER: UserDto = {
  id: "user-1",
  username: USERNAME,
  email: EMAIL,
  role: "user",
};

function lastRequest() {
  const [url, init] = safeFetch.mock.calls.at(-1)!;
  return { url, init: init! };
}

function sentBody() {
  return JSON.parse(lastRequest().init.body as string);
}

describe("userService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    safeFetch.mockResolvedValue({ success: true, status: 200 });
  });

  describe("login", () => {
    it("POSTs JSON to the web login endpoint with credentials", async () => {
      await userService.login(EMAIL, PASSWORD);

      expect(lastRequest()).toEqual({
        url: `${BASE_URL}/auth/web/login`,
        init: {
          method: "POST",
          headers: JSON_HEADERS,
          credentials: "include",
          body: expect.any(String),
        },
      });
    });

    it("sends exactly the email and password", async () => {
      await userService.login(EMAIL, PASSWORD);

      expect(sentBody()).toEqual({ email: EMAIL, password: PASSWORD });
    });
  });

  describe("logout", () => {
    it("POSTs to the web logout endpoint with credentials and no body", async () => {
      await userService.logout();

      expect(lastRequest()).toEqual({
        url: `${BASE_URL}/auth/web/logout`,
        init: { method: "POST", credentials: "include" },
      });
    });
  });

  describe("getSession", () => {
    it("GETs the current user with credentials and no body", async () => {
      await userService.getSession();

      expect(lastRequest()).toEqual({
        url: `${BASE_URL}/users/me`,
        init: { method: "GET", headers: JSON_HEADERS, credentials: "include" },
      });
    });
  });

  describe("register", () => {
    it("POSTs JSON to the web register endpoint with credentials", async () => {
      await userService.register(EMAIL, PASSWORD, USERNAME, true);

      expect(lastRequest()).toEqual({
        url: `${BASE_URL}/auth/web/register`,
        init: {
          method: "POST",
          headers: JSON_HEADERS,
          credentials: "include",
          body: expect.any(String),
        },
      });
    });

    it("sends exactly the email, password, username and terms acknowledgement", async () => {
      await userService.register(EMAIL, PASSWORD, USERNAME, true);

      expect(sentBody()).toEqual({
        email: EMAIL,
        password: PASSWORD,
        username: USERNAME,
        tosAcknowledged: true,
      });
    });

    it("sends tosAcknowledged as a boolean even when it is false", async () => {
      await userService.register(EMAIL, PASSWORD, USERNAME, false);

      expect(sentBody().tosAcknowledged).toBe(false);
    });
  });

  describe("requestPasswordReset", () => {
    it("POSTs exactly the email to the reset-token endpoint", async () => {
      await userService.requestPasswordReset(EMAIL);

      expect(lastRequest()).toEqual({
        url: `${BASE_URL}/auth/resetPasswordToken`,
        init: {
          method: "POST",
          headers: JSON_HEADERS,
          credentials: "include",
          body: expect.any(String),
        },
      });
      expect(sentBody()).toEqual({ email: EMAIL });
    });
  });

  describe("resetPassword", () => {
    it("POSTs JSON to the web reset endpoint with credentials", async () => {
      await userService.resetPassword(TOKEN, PASSWORD);

      expect(lastRequest()).toEqual({
        url: `${BASE_URL}/auth/web/resetPassword`,
        init: {
          method: "POST",
          headers: JSON_HEADERS,
          credentials: "include",
          body: expect.any(String),
        },
      });
    });

    it("sends the new password under the key `password`", async () => {
      await userService.resetPassword(TOKEN, PASSWORD);

      // The argument is called newPassword, but the server expects `password`.
      expect(sentBody()).toEqual({ token: TOKEN, password: PASSWORD });
    });
  });

  describe("requestEmailVerification", () => {
    it("POSTs exactly the email to the verification endpoint", async () => {
      await userService.requestEmailVerification(EMAIL);

      expect(lastRequest()).toEqual({
        url: `${BASE_URL}/auth/requestEmailVerification`,
        init: {
          method: "POST",
          headers: JSON_HEADERS,
          credentials: "include",
          body: expect.any(String),
        },
      });
      expect(sentBody()).toEqual({ email: EMAIL });
    });
  });

  describe("validateEmail", () => {
    it("POSTs the token as a query parameter with no body", async () => {
      await userService.validateEmail(TOKEN);

      expect(lastRequest()).toEqual({
        url: `${BASE_URL}/auth/validateEmail?token=${TOKEN}`,
        init: { method: "POST" },
      });
    });
  });

  // Each function hands back safeFetch's result untouched, so useAuth sees the
  // server's error message and status.
  describe.each([
    ["login", () => userService.login(EMAIL, PASSWORD)],
    ["logout", () => userService.logout()],
    ["getSession", () => userService.getSession()],
    ["register", () => userService.register(EMAIL, PASSWORD, USERNAME, true)],
    ["requestPasswordReset", () => userService.requestPasswordReset(EMAIL)],
    ["resetPassword", () => userService.resetPassword(TOKEN, PASSWORD)],
    ["requestEmailVerification", () => userService.requestEmailVerification(EMAIL)],
    ["validateEmail", () => userService.validateEmail(TOKEN)],
  ] as const)("%s", (_name, call) => {
    it("makes exactly one request", async () => {
      await call();

      expect(safeFetch).toHaveBeenCalledOnce();
    });

    it("returns a successful result unchanged", async () => {
      const ok = { success: true, status: 200, data: { user: USER } } as const;
      safeFetch.mockResolvedValue(ok);

      await expect(call()).resolves.toBe(ok);
    });

    it("returns a failed result unchanged", async () => {
      const failed = { success: false, status: 409, error: "Email already in use" } as const;
      safeFetch.mockResolvedValue(failed);

      await expect(call()).resolves.toBe(failed);
    });
  });
});
