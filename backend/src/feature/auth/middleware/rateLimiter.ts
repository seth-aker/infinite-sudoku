import rateLimit from "express-rate-limit";

export function authLimiter(max = 5) {
  return rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: max, 
    message: "Too many login attempts. Please try again later."
  })
}
