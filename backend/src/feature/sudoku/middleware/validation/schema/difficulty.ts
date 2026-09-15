import z from "zod/v4";

export const difficultySchema = z.enum(
  ["beginner", "easy", "medium", "hard", "impossible"],
  "Invalid difficulty",
);
