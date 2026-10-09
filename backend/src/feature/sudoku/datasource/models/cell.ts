import { CandidateSet } from "./candidateSet.ts";

export interface Cell {
  cellId: string;
  type: "prefilled" | "edited" | "blank";
  value: number | undefined;
  candidates: CandidateSet;
}
