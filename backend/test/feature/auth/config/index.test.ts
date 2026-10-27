import { beforeEach, describe, expect, it, vi } from "vitest";

async function load() {
  return (await import("@/feature/auth/config/index")).authConfig;
}

describe("authConfig", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("reads the session secret and sets the cookie name", async () => {
    vi.stubEnv("SESSION_SECRET", "s3cret");
    expect(await load()).toEqual({ secret: "s3cret", cookieName: "sudoku" });
  });

  it.each([undefined, ""])(
    "throws when SESSION_SECRET is %j",
    async (value) => {
      vi.stubEnv("SESSION_SECRET", value);
      await expect(load()).rejects.toThrow(
        "Missing Environment Variable: SESSION_SECRET",
      );
    },
  );
});
