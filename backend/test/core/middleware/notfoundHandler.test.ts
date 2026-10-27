import { describe, expect, it } from "vitest";
import { notFoundHandler } from "@/core/middleware/notfoundHandler";
import { NotFoundError } from "@/core/errors/notFoundError";
import { mockNext, mockRequest, mockResponse } from "#test/helpers/express";

describe("notFoundHandler", () => {
  it("forwards a NotFoundError describing the route", () => {
    const req = mockRequest({ method: "DELETE", originalUrl: "/api/x?y=1" });
    const res = mockResponse();
    const next = mockNext();

    notFoundHandler(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(NotFoundError);
    expect(err.message).toBe("No route for DELETE /api/x?y=1");
    expect(res.status).not.toHaveBeenCalled();
  });
});
