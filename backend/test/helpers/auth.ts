import { vi, type Mock } from "vitest";
import type { Router } from "express";
import { createApp } from "@/app";
import { config } from "@/core/config";
import type { AuthenticationService } from "@/feature/auth/service/authenticationService";
import { startServer, type TestServer } from "./http";

export const TEST_USER = {
  id: "3f0c7a4e-1b2d-4c5e-8f9a-0b1c2d3e4f5a",
  email: "player@example.com",
  emailVerified: true,
  username: "player",
  role: "user" as const,
};

export const STRONG_PASSWORD = "Str0ng!pass";
export const RESET_TOKEN = "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d";

export type FakeAuthService = { [K in keyof AuthenticationService]: Mock };

/** An AuthenticationService whose methods are mocks with happy-path defaults. */
export function fakeAuthService(): FakeAuthService {
  return {
    verify: vi.fn().mockResolvedValue(TEST_USER),
    registerUser: vi.fn().mockResolvedValue({
      userId: TEST_USER.id,
      accessToken: "new-access",
      refreshToken: "new-refresh",
    }),
    getNewTokenSet: vi.fn().mockResolvedValue({
      accessToken: "new-access",
      refreshToken: "new-refresh",
    }),
    refreshAccessToken: vi.fn().mockResolvedValue({
      accessToken: "rotated-access",
      refreshToken: "rotated-refresh",
    }),
    clearRefreshToken: vi.fn().mockResolvedValue(undefined),
    requestPasswordResetToken: vi.fn().mockResolvedValue(undefined),
    resetPassword: vi.fn().mockResolvedValue(undefined),
    validateEmail: vi.fn().mockResolvedValue(true),
    requestEmailVerification: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Mounts a router under /api through the real app. The default path matches
 * compose.ts; pass "/auth/web" or "/auth/mobile" for the sub-routers.
 */
export function startAuthServer(router: Router, path = "/auth"): Promise<TestServer> {
  const app = createApp({
    config: { ...config, isProduction: false },
    routers: [{ path, router }],
  });
  return startServer(app);
}

/** Parses Set-Cookie headers into name -> { value, expired }. */
export function setCookies(res: Response) {
  return Object.fromEntries(
    res.headers.getSetCookie().map((header) => {
      const [pair = ""] = header.split(";");
      const [name = "", value = ""] = pair.split("=");
      const expires = /expires=([^;]+)/i.exec(header)?.[1];
      const expired = expires !== undefined && new Date(expires).getTime() < Date.now();
      return [name, { value, expired }];
    }),
  );
}
