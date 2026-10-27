import { describe, expect, it } from "vitest";
import type { Request } from "express";
import {
  clearAuthCookies,
  getAuthCookies,
  setAuthCookies,
} from "@/feature/auth/utils/cookies";
import { mockRequest, mockResponse } from "#test/helpers/express";

const accessOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  maxAge: 15 * 60 * 1000,
};
const refreshOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: "/api/auth/web/refresh",
};

describe("cookies", () => {
  describe("setAuthCookies", () => {
    it("sets the access and refresh cookies with secure options", () => {
      const res = mockResponse();
      setAuthCookies(res, "access", "refresh");
      expect(res.cookie.mock.calls).toEqual([
        ["accessToken", "access", accessOptions],
        ["refreshToken", "refresh", refreshOptions],
      ]);
    });
  });

  describe("clearAuthCookies", () => {
    it("clears both cookies with matching options", () => {
      const res = mockResponse();
      clearAuthCookies(res);
      expect(res.clearCookie.mock.calls).toEqual([
        ["accessToken", accessOptions],
        ["refreshToken", refreshOptions],
      ]);
    });
  });

  describe("getAuthCookies", () => {
    it("returns both tokens", () => {
      const req = mockRequest<Request>({
        cookies: { accessToken: "a", refreshToken: "r" },
      });
      expect(getAuthCookies(req)).toEqual({
        accessToken: "a",
        refreshToken: "r",
      });
    });

    it("returns undefined for missing cookies", () => {
      const req = mockRequest<Request>({ cookies: {} });
      expect(getAuthCookies(req)).toEqual({
        accessToken: undefined,
        refreshToken: undefined,
      });
    });
  });
});
