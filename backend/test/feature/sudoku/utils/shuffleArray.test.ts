import { describe, expect, it, vi } from "vitest";
import { shuffleArray } from "@/feature/sudoku/utils/shuffleArray";

describe("shuffleArray", () => {
  it("shuffles in place and keeps all elements", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const ref = input;
    shuffleArray(input);
    expect(input).toBe(ref);
    expect([...input].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("implements a Fisher-Yates shuffle driven by Math.random", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(0);
    const input = ["a", "b", "c", "d"];
    shuffleArray(input);
    expect(random).toHaveBeenCalledTimes(3);
    expect(input).toEqual(["b", "c", "d", "a"]);
  });

  it("leaves the array unchanged when random picks the current index", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.999999);
    const input = [1, 2, 3, 4];
    shuffleArray(input);
    expect(input).toEqual([1, 2, 3, 4]);
  });

  it.each([[[]], [[1]]])("handles trivial arrays (%j)", (input) => {
    const random = vi.spyOn(Math, "random");
    const copy = [...input];
    shuffleArray(input);
    expect(input).toEqual(copy);
    expect(random).not.toHaveBeenCalled();
  });
});
