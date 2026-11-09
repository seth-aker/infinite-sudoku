import { Request } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { createHash } from "node:crypto";

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

const emailFrom = (req: Request) => {
  return typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : undefined;
}

const ipFrom = (req: Request) => ipKeyGenerator(req.ip!);

const perIpAndEmail = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 5,
  keyGenerator: (req) => `login:ip-email:${ipFrom(req)}:${emailFrom(req) ?? ""}`,
  skipSuccessfulRequests: true,
});

const perIp = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 20,
  keyGenerator: (req) => `login:ip:${ipFrom(req)}`,
  skipSuccessfulRequests: true,
});

const perEmail = rateLimit({
  windowMs: ONE_HOUR,
  limit: 50,
  keyGenerator: (req) => `login:email:${emailFrom(req) ?? `ip:${ipFrom(req)}`}`,
  skipSuccessfulRequests: true,
})

export const passwordGrantLimiter = [perIpAndEmail, perIp, perEmail];

export const refreshGrantLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 5,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const token = req.body?.refreshToken ?? req.cookies?.refreshToken;
    if (token && typeof token === 'string') {
      const tokenHash = createHash("sha256").update(token).digest("hex");
      return `refresh-token:${tokenHash}`;
    }
    return `refresh:ip:${ipFrom(req)}`;
  },
});

export const resetPasswordRateLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  limit: 3,
  skipSuccessfulRequests: true,
  keyGenerator: (req: Request) => {
    const resetToken = req.body?.token;
    if (resetToken && typeof resetToken === 'string') {
      const tokenHash = createHash("sha256").update(resetToken).digest("hex");
      return `reset-password-token:${tokenHash}`;
    }
    return `reset-password:ip:${ipFrom(req)}`;
  },
});

const tokenRequestPerEmailAndIp = rateLimit({
  windowMs: ONE_HOUR,
  limit: 3,
  skipSuccessfulRequests: false,
  keyGenerator: (req: Request) => `token-request:ip-email:${ipFrom(req)}:${emailFrom(req) ?? ""}`
})
const tokenRequestPerIp = rateLimit({
  windowMs: ONE_HOUR,
  limit: 10,
  skipSuccessfulRequests: false,
  keyGenerator: (req: Request) => `token-request:ip:${ipFrom(req)}`
})
const tokenRequestPerEmail = rateLimit({
  windowMs: ONE_HOUR,
  limit: 5,
  skipSuccessfulRequests: false,
  keyGenerator: (req: Request) => `token-request:email:${emailFrom(req) ?? `ip:${ipFrom(req)}`}`,
})

export const tokenRequestRateLimiter = [tokenRequestPerEmailAndIp, tokenRequestPerIp, tokenRequestPerEmail];
