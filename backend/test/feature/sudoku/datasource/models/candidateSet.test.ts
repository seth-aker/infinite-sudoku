import { describe, expect, it } from "vitest";
import { CandidateSet } from "@/feature/sudoku/datasource/models/candidateSet";

describe("CandidateSet", () => {
  it("is a Set", () => {
    expect(new CandidateSet()).toBeInstanceOf(Set);
  });

  it.each([undefined, null])("starts empty when given %s", (values) => {
    expect(new CandidateSet(values).size).toBe(0);
  });

  it("deduplicates initial values", () => {
    const set = new CandidateSet([1, 2, 2, 3]);
    expect(set.size).toBe(3);
    expect(set.has(2)).toBe(true);
  });

  it("serializes to a JSON array in insertion order", () => {
    const set = new CandidateSet([3, 1]);
    set.add(9);
    expect(set.toJSON()).toEqual([3, 1, 9]);
    expect(JSON.stringify({ candidates: set })).toBe('{"candidates":[3,1,9]}');
  });

  it("serializes an empty set to an empty array", () => {
    expect(JSON.stringify(new CandidateSet())).toBe("[]");
  });
});
