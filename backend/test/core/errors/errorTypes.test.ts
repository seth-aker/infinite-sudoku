import { describe, expect, it } from "vitest";
import { ErrorType } from "@/core/errors/errorTypes";

describe("ErrorType", () => {
  it("exposes the expected error codes", () => {
    expect(ErrorType).toEqual({
      VALIDATION_FAILED: "validation_failed",
      MALFORMED_BODY: "malformed_body",
      BAD_REQUEST: "bad_request",
      INVALID_CREDENTIALS: "invalid_credentials",
      TOKEN_MISSING: "token_missing",
      TOKEN_EXPIRED: "token_expired",
      TOKEN_INVALID: "token_invalid",
      TOKEN_REVOKED: "token_revoked",
      TOKEN_REUSE_DETECTED: "token_reuse_detected",
      UNVERIFIED_EMAIL: "unverified_email",
      INSUFFICIENT_ROLE: "insufficient_role",
      ROUTE_NOT_FOUND: "route_not_found",
      RESOURCE_NOT_FOUND: "resource_not_found",
      USERNAME_TAKEN: "username_taken",
      RESOURCE_CONFLICT: "resource_conflict",
      RATE_LIMITED: "rate_limited",
      INTERNAL_ERROR: "internal_error",
    });
  });

  it("has unique values", () => {
    const values = Object.values(ErrorType);
    expect(new Set(values).size).toBe(values.length);
  });
});
