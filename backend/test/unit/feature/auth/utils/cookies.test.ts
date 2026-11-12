import { afterEach, beforeEach, describe, expect, it } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import {
  clearAuthCookies,
  setAuthCookies,
} from "@/feature/auth/utils/cookies";
import { startServer, type TestServer } from "#test/helpers/http";

const FIFTEEN_MINUTES_S = 15 * 60;
const THIRTY_DAYS_S = 30 * 24 * 60 * 60;
const REFRESH_PATH = "/api/auth/web";

// Parses a Set-Cookie header into its name, value and lowercased attributes.
function parseSetCookie(header: string) {
  const [pair = "", ...attrs] = header.split(";").map((part) => part.trim());
  const [name, value] = pair.split("=");
  const attributes = Object.fromEntries(
    attrs.map((attr) => {
      const [key = "", val = true] = attr.split("=");
      return [key.toLowerCase(), val];
    }),
  );
  return { name, value, attributes };
}

describe("auth cookies", () => {
  let server: TestServer;

  // A real Express response, so the tests check the Set-Cookie headers the
  // browser actually receives rather than the options passed to res.cookie.
  beforeEach(async () => {
    const app = express();
    app.use(cookieParser());
    app.get("/set", (_req, res) => {
      setAuthCookies(res, "access-jwt", "refresh-jwt");
      res.sendStatus(204);
    });
    app.get("/clear", (_req, res) => {
      clearAuthCookies(res);
      res.sendStatus(204);
    });
    server = await startServer(app);
  });

  afterEach(async () => {
    await server.close();
  });

  async function cookiesFrom(path: string) {
    const res = await server.get(path);
    const cookies = res.headers.getSetCookie().map(parseSetCookie);
    return Object.fromEntries(cookies.map((c) => [c.name, c]));
  }

  describe("setAuthCookies", () => {
    it("sets exactly the access and refresh cookies", async () => {
      const cookies = await cookiesFrom("/set");
      expect(Object.keys(cookies).sort()).toEqual(["accessToken", "refreshToken"]);
      expect(cookies.accessToken.value).toBe("access-jwt");
      expect(cookies.refreshToken.value).toBe("refresh-jwt");
    });

    it.each(["accessToken", "refreshToken"])(
      "marks %s HttpOnly, Secure and SameSite=Lax",
      async (name) => {
        const { attributes } = (await cookiesFrom("/set"))[name];
        expect(attributes).toMatchObject({
          httponly: true,
          secure: true,
          samesite: "Lax",
        });
      },
    );

    it("expires the access token after 15 minutes and sends it site-wide", async () => {
      const { attributes } = (await cookiesFrom("/set")).accessToken;
      expect(attributes["max-age"]).toBe(String(FIFTEEN_MINUTES_S));
      expect(attributes.path).toBe("/");
    });

    it("expires the refresh token after 30 days and only sends it to the refresh route", async () => {
      const { attributes } = (await cookiesFrom("/set")).refreshToken;
      expect(attributes["max-age"]).toBe(String(THIRTY_DAYS_S));
      expect(attributes.path).toBe(REFRESH_PATH);
    });

    it("does not set a Domain, so cookies stay host-only", async () => {
      const cookies = await cookiesFrom("/set");
      expect(cookies.accessToken.attributes.domain).toBeUndefined();
      expect(cookies.refreshToken.attributes.domain).toBeUndefined();
    });
  });

  describe("clearAuthCookies", () => {
    it("expires both cookies with empty values", async () => {
      const cookies = await cookiesFrom("/clear");
      for (const name of ["accessToken", "refreshToken"]) {
        expect(cookies[name].value).toBe("");
        expect(new Date(cookies[name].attributes.expires as string).getTime()).toBeLessThan(
          Date.now(),
        );
      }
    });

    it("does not let maxAge keep cleared cookies alive", async () => {
      // Express 5's clearCookie drops maxAge; if it didn't, the cookie would be
      // "cleared" with a fresh 15 minute / 30 day lifetime.
      const cookies = await cookiesFrom("/clear");
      expect(cookies.accessToken.attributes["max-age"]).toBeUndefined();
      expect(cookies.refreshToken.attributes["max-age"]).toBeUndefined();
    });

    it("uses the same path as when the cookies were set", async () => {
      // Browsers only overwrite a cookie whose name, domain and path all match.
      const cookies = await cookiesFrom("/clear");
      expect(cookies.accessToken.attributes.path).toBe("/");
      expect(cookies.refreshToken.attributes.path).toBe(REFRESH_PATH);
    });

    it("keeps the security attributes", async () => {
      const cookies = await cookiesFrom("/clear");
      for (const name of ["accessToken", "refreshToken"]) {
        expect(cookies[name].attributes).toMatchObject({
          httponly: true,
          secure: true,
          samesite: "Lax",
        });
      }
    });
  });
});
