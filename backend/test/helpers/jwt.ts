import { SignJWT } from "jose";
import { config } from "@/core/config";

export interface TokenOptions {
  sub?: string;
  role?: "user" | "admin" | string;
  emailVerified?: boolean;
  secret?: string;
  issuer?: string;
  audience?: string;
  expiresAt?: number | string;
}

export async function signAccessToken(opts: TokenOptions = {}) {
  const jwt = new SignJWT({
    role: opts.role ?? "user",
    emailVerified: opts.emailVerified ?? true,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(opts.issuer ?? config.issuer)
    .setAudience(opts.audience ?? config.audience)
    .setExpirationTime(opts.expiresAt ?? "15m");
  if (opts.sub !== undefined) jwt.setSubject(opts.sub);
  return jwt.sign(new TextEncoder().encode(opts.secret ?? config.jwtSecret));
}

export function expiredTimestamp() {
  return Math.floor(Date.now() / 1000) - 60;
}
