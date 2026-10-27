import { describe, expect, it } from "vitest";
import { objectIdSchema } from "@/core/validation/objectId";

describe("objectIdSchema", () => {
  it.each(["507f1f77bcf86cd799439011", "ABCDEFabcdef012345678901"])(
    "accepts %s",
    (id) => {
      expect(objectIdSchema.safeParse(id).success).toBe(true);
    },
  );

  it.each([
    ["too short", "507f1f77bcf86cd79943901"],
    ["too long", "507f1f77bcf86cd7994390111"],
    ["non-hex", "507f1f77bcf86cd79943901z"],
    ["empty", ""],
  ])("rejects ids that are %s", (_label, id) => {
    const result = objectIdSchema.safeParse(id);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Invalid ObjectId");
  });

  it("rejects non-strings", () => {
    expect(objectIdSchema.safeParse(123).success).toBe(false);
  });
});
