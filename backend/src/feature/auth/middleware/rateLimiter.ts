import { NextFunction, Request, Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { createHash } from "node:crypto";

const FIFTEEN_MINUTES = 15 * 60 * 1000;
function passwordGrantLimiter() {
  return rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit: 5,
    skipSuccessfulRequests: true,
    keyGenerator: (req: Request) => {
      const email = req.body?.email as string;
      return email ? `login:${email.toLowerCase()}` : `ip:${ipKeyGenerator(req.ip!)}`
    }
  })
}

function refreshGrantLimiter() {
  return rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit: 5,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => {
      const token = req.body?.refreshToken as string;
      if(token) {
	const tokenHash = createHash('sha256').update(token).digest('hex');
	return `rt:${tokenHash}`;
      }
      return `ip:${ipKeyGenerator(req.ip!)}`
    }
  })
}
export function resetPasswordRateLimiter() {
  return rateLimit({
    windowMs: FIFTEEN_MINUTES,
    limit: 3,
    skipSuccessfulRequests: true,
    keyGenerator: (req: Request) => {
      const email = req.body?.email as string;
      return email ? `passwordReset:${email.toLowerCase()}` : `ip:${ipKeyGenerator(req.ip!)}`;
    }
  })
}
export function authLimiter() {
  const password = passwordGrantLimiter();
  const refresh = refreshGrantLimiter();
  return (req: Request, res: Response, next: NextFunction) =>
    req.body?.grantType === 'refreshToken'
      ? refresh(req, res, next)
      : password(req, res, next);
}
