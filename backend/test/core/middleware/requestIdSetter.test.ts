import { describe, expect, it } from "vitest";
import type { Request } from "express";
import { requestIdSetter } from "@/core/middleware/requestIdSetter";
import { mockNext, mockRequest, mockResponse } from "#test/helpers/express";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function run(headers: Record<string, string> = {}) {
  const req = mockRequest<Request>({ headers });
  const res = mockResponse();
  const next = mockNext();
  requestIdSetter(req, res, next);
  return { req, res, next };
}

describe("requestIdSetter", () => {
  it("generates a uuid when no inbound id is present", () => {
    const { req, res, next } = run();
    expect(req.id).toMatch(UUID_RE);
    expect(res.setHeader).toHaveBeenCalledWith("x-request-id", req.id);
    expect(next).toHaveBeenCalledWith();
  });

  it("generates unique ids per request", () => {
    expect(run().req.id).not.toBe(run().req.id);
  });

  it.each(["abc-123", "A", "a".repeat(64), "UPPER-lower-0123"])(
    "reuses a safe inbound id (%s)",
    (inbound) => {
      const { req, res, next } = run({ "x-request-id": inbound });
      expect(req.id).toBe(inbound);
      expect(res.setHeader).toHaveBeenCalledWith("x-request-id", inbound);
      expect(next).toHaveBeenCalledWith();
    },
  );

  it.each([
    ["too long", "a".repeat(65)],
    ["empty", ""],
    ["with spaces", "abc 123"],
    ["with header injection characters", "abc\r\nset-cookie: x"],
    ["with a trailing newline", "abc\n"],
    ["with underscores", "abc_123"],
    ["with slashes", "../etc"],
  ])("replaces an unsafe inbound id (%s)", (_label, inbound) => {
    const { req, res, next } = run({ "x-request-id": inbound });
    expect(req.id).toMatch(UUID_RE);
    expect(res.setHeader).toHaveBeenCalledWith("x-request-id", req.id);
    expect(next).toHaveBeenCalledWith();
  });
});
