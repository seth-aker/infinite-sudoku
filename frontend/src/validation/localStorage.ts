import { z } from "zod/v4"
import { DIFFICULTY_RATINGS, GAME_STATUSES } from "@/stores/gameStore";
export const SNAPSHOT_VERSION = 1;
export const CellSchema = z.object({
  idx: z.number().int().min(0).max(80),
  value: z.number().int().min(0).max(9),
  candidates: z.array(z.number().int().min(1).max(9)),
});

export const PuzzleSchema = z
  .array(CellSchema)
  .length(81)
  .refine((cells) => cells.every((c, i) => c.idx === i), "cell idx does not match position")

export const ActionSchema = z.object({
  cell: CellSchema,
  isParent: z.boolean()
})

export const GameSnapshotSchema = z.object({
  version: z.literal(SNAPSHOT_VERSION),
  puzzleId: z.string().optional(),
  cells: PuzzleSchema,
  originalCells: PuzzleSchema,
  difficultyRating: z.enum(DIFFICULTY_RATINGS).optional(),
  difficultyScore: z.number(),
  usingPencil: z.boolean(),
  selectedIdx: z.number().int().min(0).max(80).optional(),
  history: z.array(ActionSchema),
  redoActions: z.array(ActionSchema),
  autoCandidateMode: z.boolean(),
  elapsedSeconds: z.number().int().min(0),
  state: z.enum(GAME_STATUSES),
});

export type GameSnapshot = Omit<z.infer<typeof GameSnapshotSchema>, 'version'>;

