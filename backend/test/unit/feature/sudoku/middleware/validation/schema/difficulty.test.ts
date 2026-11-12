import { describe, expect, it } from "vitest";
import { difficultySchema } from "@/feature/sudoku/middleware/validation/schema/difficulty";

describe("difficultySchema", () => {
  it.each(["beginner", "easy", "medium", "hard"])("accepts %s", (value) => {
    expect(difficultySchema.parse(value)).toBe(value);
  });

  it.each(["impossible", "", "Easy", "EASY", "extreme", 1, null, undefined, ["easy"]])(
    "rejects %j with the custom message",
    (value) => {
      const result = difficultySchema.safeParse(value);
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.message).toBe("Invalid difficulty");
    },
  );
});
