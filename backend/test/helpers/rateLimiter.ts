import { expect, vi, type Mock } from "vitest";
import type { RequestHandler } from "express";

const passThrough = () => vi.fn<RequestHandler>((_req, _res, next) => next());

/**
 * Replaces every limiter exported by the real rateLimiter module with a
 * pass-through spy of the same shape: a single handler stays a single handler,
 * and an array of handlers becomes an array of the same length. Built from
 * the real exports, so the mock can't drift from them.
 *
 *   vi.mock("@/feature/auth/middleware/rateLimiter", async (importOriginal) => {
 *     const { passThroughLimiters } = await import("#test/helpers/rateLimiter");
 *     return passThroughLimiters(await importOriginal());
 *   });
 */
export function passThroughLimiters<T extends Record<string, unknown>>(actual: T): T {
  return Object.fromEntries(
    Object.entries(actual).map(([name, value]) => {
      if (Array.isArray(value)) return [name, value.map(passThrough)];
      if (typeof value === "function") return [name, passThrough()];
      return [name, value];
    }),
  ) as T;
}

/** Asserts that every handler in a (mocked) limiter chain ran exactly once. */
export function expectLimiterApplied(limiter: RequestHandler | RequestHandler[]) {
  const chain = [limiter].flat() as Mock[];
  expect(chain.length).toBeGreaterThan(0);
  for (const handler of chain) expect(handler).toHaveBeenCalledOnce();
}
