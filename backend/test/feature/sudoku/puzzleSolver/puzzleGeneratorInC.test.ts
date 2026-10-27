import { beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { env } from "node:process";
import { spawn } from "node:child_process";
import { worker, workerEmit } from "workerpool";
import { generatePuzzles } from "@/feature/sudoku/puzzleSolver/puzzleGeneratorInC";
import { PuzzleGeneratorError } from "@/feature/sudoku/errors/puzzleGeneratorError";
import type { DifficultyRating } from "@/feature/sudoku/datasource/models/difficulty";

vi.mock("node:child_process", () => ({ spawn: vi.fn() }));
vi.mock("workerpool", () => ({ worker: vi.fn(), workerEmit: vi.fn() }));

class FakeProcess extends EventEmitter {
  stdout = new EventEmitter();
  write(chunk: string) {
    this.stdout.emit("data", Buffer.from(chunk));
  }
  close(code: number | null, signal: string | null = null) {
    this.emit("close", code, signal);
  }
}

const A = "1".repeat(81);
const B = "2".repeat(81);
const line = (score: string, rating: string) => `${A}:${B}:${score}:${rating}`;

describe("puzzleGeneratorInC", () => {
  let proc: FakeProcess;

  beforeEach(() => {
    proc = new FakeProcess();
    vi.mocked(spawn).mockReturnValue(proc as never);
  });

  it("registers generatePuzzles with the worker", async () => {
    vi.resetModules();
    vi.mocked(worker).mockClear();
    const mod =
      await import("@/feature/sudoku/puzzleSolver/puzzleGeneratorInC");
    expect(worker).toHaveBeenCalledWith({
      generatePuzzles: mod.generatePuzzles,
    });
  });

  it.each<[DifficultyRating, string]>([
    ["beginner", "BEGINNER"],
    ["easy", "EASY"],
    ["medium", "MEDIUM"],
    ["hard", "HARD"],
    ["impossible", "IMPOSSIBLE"],
    ["unknown" as DifficultyRating, "BEGINNER"],
  ])("spawns the generator for %s as %s", async (difficulty, arg) => {
    const done = generatePuzzles(25, { difficulty });
    proc.close(0);
    await done;
    expect(spawn).toHaveBeenCalledWith(
      "/root/dir/puzzle_generator_app",
      [arg, "25"],
      { env },
    );
  });

  it("emits a puzzle for each complete line", async () => {
    const done = generatePuzzles(2, { difficulty: "easy" });
    proc.write(`${line("10", "1")}\n${line("20", "2")}\n`);
    proc.close(0);
    await expect(done).resolves.toBeUndefined();
    expect(vi.mocked(workerEmit).mock.calls).toEqual([
      [{ cells: A, solvedCells: B, score: 10, rating: "easy" }],
      [{ cells: A, solvedCells: B, score: 20, rating: "medium" }],
    ]);
  });

  it("buffers partial lines across chunks", async () => {
    const done = generatePuzzles(1, { difficulty: "easy" });
    const full = `${line("7", "3")}\n`;
    proc.write(full.slice(0, 50));
    expect(workerEmit).not.toHaveBeenCalled();
    proc.write(full.slice(50));
    expect(workerEmit).toHaveBeenCalledTimes(1);
    proc.close(0);
    await done;
    expect(workerEmit).toHaveBeenCalledWith({
      cells: A,
      solvedCells: B,
      score: 7,
      rating: "hard",
    });
  });

  it("skips blank and whitespace-only lines", async () => {
    const done = generatePuzzles(1, { difficulty: "easy" });
    proc.write(`\n   \n${line("1", "0")}\n\n`);
    proc.close(0);
    await done;
    expect(workerEmit).toHaveBeenCalledTimes(1);
  });

  it("processes a trailing line without a newline on close", async () => {
    const done = generatePuzzles(1, { difficulty: "easy" });
    proc.write(line("5", "0"));
    expect(workerEmit).not.toHaveBeenCalled();
    proc.close(0);
    await done;
    expect(workerEmit).toHaveBeenCalledWith({
      cells: A,
      solvedCells: B,
      score: 5,
      rating: "beginner",
    });
  });

  it("ignores a whitespace-only trailing buffer on close", async () => {
    const done = generatePuzzles(1, { difficulty: "easy" });
    proc.write("   ");
    proc.close(0);
    await done;
    expect(workerEmit).not.toHaveBeenCalled();
  });

  it.each([
    ["0", "beginner"],
    ["1", "easy"],
    ["2", "medium"],
    ["3", "hard"],
    ["4", "impossible"],
    ["", "impossible"],
  ])("maps rating %j to %s", async (code, rating) => {
    const done = generatePuzzles(1, { difficulty: "easy" });
    proc.write(`${line("1", code)}\n`);
    proc.close(0);
    await done;
    expect(vi.mocked(workerEmit).mock.calls[0][0]).toMatchObject({ rating });
  });

  it("parses a non-numeric score as NaN", async () => {
    const done = generatePuzzles(1, { difficulty: "easy" });
    proc.write(`${line("abc", "1")}\n`);
    proc.close(0);
    await done;
    expect(vi.mocked(workerEmit).mock.calls[0][0]).toMatchObject({
      score: NaN,
    });
  });

  it("rejects with PuzzleGeneratorError on a non-zero exit code", async () => {
    const done = generatePuzzles(1, { difficulty: "easy" });
    proc.close(2);
    const err = await done.catch((e) => e);
    expect(err).toBeInstanceOf(PuzzleGeneratorError);
    expect(err.message).toBe("Generator exited with code 2. Node signal: NULL");
  });

  it("includes the signal when killed", async () => {
    const done = generatePuzzles(1, { difficulty: "easy" });
    proc.close(null, "SIGKILL");
    await expect(done).rejects.toThrow(
      "Generator exited with code null. Node signal: SIGKILL",
    );
  });

  it("still emits buffered output before rejecting", async () => {
    const done = generatePuzzles(1, { difficulty: "easy" });
    proc.write(line("1", "1"));
    proc.close(1);
    await expect(done).rejects.toBeInstanceOf(PuzzleGeneratorError);
    expect(workerEmit).toHaveBeenCalledTimes(1);
  });

  it("rejects when the process fails to spawn", async () => {
    const done = generatePuzzles(1, { difficulty: "easy" });
    const err = new Error("ENOENT");
    proc.emit("error", err);
    await expect(done).rejects.toBe(err);
  });
});
