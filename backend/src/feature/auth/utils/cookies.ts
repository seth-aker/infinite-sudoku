import { CookieOptions, Response } from "express";

const FIFTEEN_MINUTES = 1000 * 60 * 15;
const THIRTY_DAYS = 1000 * 60 * 60 * 24 * 30;

const REFRESH_PATH = "/api/auth/web";

const ACCESS_TOKEN_COOKIE: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  maxAge: FIFTEEN_MINUTES,
};
const REFRESH_TOKEN_COOKIE: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  maxAge: THIRTY_DAYS,
  path: REFRESH_PATH,
};

export function setAuthCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
) {
  // KEEP UNTIL 12/24/26 to ensure are cookies are cleared from old path.
  res.clearCookie("refreshToken", { ...REFRESH_TOKEN_COOKIE, path: "/api/auth/web/refresh" })
  res.cookie("accessToken", accessToken, ACCESS_TOKEN_COOKIE);
  res.cookie("refreshToken", refreshToken, REFRESH_TOKEN_COOKIE);
}
export function clearAuthCookies(res: Response) {
  // KEEP UNTIL 12/24/26 to ensure are cookies are cleared from old path.
  res.clearCookie("refreshToken", { ...REFRESH_TOKEN_COOKIE, path: "/api/auth/web/refresh" })
  res.clearCookie("accessToken", ACCESS_TOKEN_COOKIE);
  res.clearCookie("refreshToken", REFRESH_TOKEN_COOKIE);
}
