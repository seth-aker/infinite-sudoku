export const ErrorType = {
  // 400
  VALIDATION_FAILED: "validation_failed",
  MALFORMED_BODY: "malformed_body",
  // 401
  INVALID_CREDENTIALS: "invalid_credentials",
  TOKEN_MISSING: "token_missing",
  TOKEN_EXPIRED: "token_expired",
  TOKEN_INVALID: "token_invalid",
  TOKEN_REVOKED: "token_revoked",
  TOKEN_REUSE_DETECTED: "token_reuse_detected",
  UNVERIFIED_EMAIL: "unverified_email",
  // 403
  INSUFFICIENT_ROLE: "insufficient_role",
  // 404
  ROUTE_NOT_FOUND: "route_not_found",
  RESOURCE_NOT_FOUND: "resource_not_found",
  // 409
  USERNAME_TAKEN: "username_taken",
  RESOURCE_CONFLICT: "resource_conflict",
  // 429
  RATE_LIMITED: "rate_limited",
  // 500
  INTERNAL_ERROR: "internal_error",
} as const;

export type ErrorType = (typeof ErrorType)[keyof typeof ErrorType];
