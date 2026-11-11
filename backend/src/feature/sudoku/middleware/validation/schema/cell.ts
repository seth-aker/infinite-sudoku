import z from "zod/v4";
const CELL_COUNT = 81;

const cellCandidateSchema = z
  .string()
  .max(9, "Cannot be more than 9 digits")
  .regex(/^[1-9]+$/, "Candidates must only be values 1-9")
export const candidateStringSchema = z.string().superRefine((val, ctx) => {
  const cells = val.split(":");
  if (cells.length !== CELL_COUNT) {
    ctx.addIssue({
      code: "custom",
      message: `Expected ${CELL_COUNT} cells, received ${cells.length}`,
    })
    return;
  }
  for (const [index, candidateStr] of cells.entries()) {
    if (candidateStr.length === 0) {
      continue;
    }
    const res = cellCandidateSchema.safeParse(candidateStr);
    if (!res.success) {
      ctx.addIssue({
        code: 'custom',
        message: res.error.issues[0]!.message,
        path: [index]
      })
      return;
    }
  }
});
