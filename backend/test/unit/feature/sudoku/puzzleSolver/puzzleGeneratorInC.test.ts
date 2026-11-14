import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The module registers itself with workerpool and spawns the C binary, so
// both are mocked: tests drive the fake process's stdout and exit.
const { spawn, workerEmit, worker } = vi.hoisted(() => ({
  spawn: vi.fn(),
  workerEmit: vi.fn(),
  worker: vi.fn(),
}));
vi.mock("node:child_process", () => ({ spawn }));
vi.mock("workerpool", () => ({ workerEmit, worker }));

import {
  generatePuzzles,
  MAX_STDERR_CHARS,
} from "@/feature/sudoku/puzzleSolver/puzzleGeneratorInC";
import { PuzzleGeneratorError } from "@/feature/sudoku/errors/puzzleGeneratorError";
import { expectLogged } from "#test/helpers/logger";

const CELLS = "0".repeat(81);
const SOLVED = "1".repeat(81);
const line = (rating = "1", score = "42", cells = CELLS, solved = SOLVED) =>
  `${cells}:${solved}:${score}:${rating}`;

// What the C app prints to stderr when LOG_DIR isn't writable.
const LOG_OPEN_FAILURE =
  "00:35:45 ERROR /cdoku/src/app/app_conf.c:90: Failed to open file at: /sudoku/logs/puzzle_generator_app.log\n";

class FakeProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  write(chunk: string) {
    this.stdout.emit("data", Buffer.from(chunk));
  }
  writeErr(chunk: string) {
    this.stderr.emit("data", Buffer.from(chunk));
  }
  exit(code: number | null = 0, signal: string | null = null) {
    this.emit("close", code, signal);
  }
}

let proc: FakeProcess;
const emitted = () => workerEmit.mock.calls.map(([puzzle]) => puzzle);

beforeEach(() => {
  proc = new FakeProcess();
  spawn.mockReturnValue(proc);
});

it("registers generatePuzzles with the worker pool when loaded", async () => {
  // Registration happens at import, before clearMocks wipes the calls, so
  // load a fresh copy of the module to observe it.
  vi.resetModules();
  const fresh = await import("@/feature/sudoku/puzzleSolver/puzzleGeneratorInC");
  expect(worker).toHaveBeenCalledOnce();
  expect(worker).toHaveBeenCalledWith({ generatePuzzles: fresh.generatePuzzles });
});

describe("generatePuzzles", () => {
  describe("spawning the generator", () => {
    it("runs the binary from the root dir with the count", async () => {
      const done = generatePuzzles(100, { difficulty: "easy" });
      proc.exit(0);
      await done;
      expect(spawn).toHaveBeenCalledWith(
        "/root/dir/puzzle_generator_app",
        ["EASY", "100"],
        expect.objectContaining({ env: expect.any(Object) }),
      );
    });

    it("passes LOG_DIR through to the generator", async () => {
      // The C app exits immediately if LOG_DIR is unset.
      vi.stubEnv("LOG_DIR", "/sudoku/logs");
      const done = generatePuzzles(1, { difficulty: "easy" });
      proc.exit(0);
      await done;
      expect(spawn.mock.calls[0]![2].env).toMatchObject({ LOG_DIR: "/sudoku/logs" });
    });

    it("logs the binary path and args before spawning", async () => {
      const done = generatePuzzles(5, { difficulty: "hard" });
      proc.exit(0);
      await done;
      expectLogged("debug", {
        generatorPath: "/root/dir/puzzle_generator_app",
        args: ["HARD", "5"],
      });
    });

    it.each([
      ["beginner", "BEGINNER"],
      ["easy", "EASY"],
      ["medium", "MEDIUM"],
      ["hard", "HARD"],
      ["impossible", "IMPOSSIBLE"],
    ] as const)("passes %s as %s", async (difficulty, arg) => {
      const done = generatePuzzles(1, { difficulty });
      proc.exit(0);
      await done;
      expect(spawn.mock.calls[0]![1]).toEqual([arg, "1"]);
    });
  });

  describe("parsing output", () => {
    it("emits one puzzle per line", async () => {
      const done = generatePuzzles(2, { difficulty: "easy" });
      proc.write(`${line("1", "10")}\n${line("1", "11")}\n`);
      proc.exit(0);
      await done;
      expect(emitted()).toEqual([
        { cells: CELLS, solvedCells: SOLVED, score: 10, rating: "easy" },
        { cells: CELLS, solvedCells: SOLVED, score: 11, rating: "easy" },
      ]);
    });

    it("emits each puzzle as soon as its line is complete", async () => {
      const done = generatePuzzles(2, { difficulty: "easy" });
      proc.write(`${line()}\n`);
      expect(workerEmit).toHaveBeenCalledOnce();
      proc.exit(0);
      await done;
    });

    it("joins a line split across output chunks", async () => {
      const full = line("2", "77");
      const done = generatePuzzles(1, { difficulty: "medium" });
      proc.write(full.slice(0, 50));
      proc.write(full.slice(50, 120));
      expect(workerEmit).not.toHaveBeenCalled();
      proc.write(`${full.slice(120)}\n`);
      proc.exit(0);
      await done;
      expect(emitted()).toEqual([{ cells: CELLS, solvedCells: SOLVED, score: 77, rating: "medium" }]);
    });

    it("emits a final line that has no trailing newline when the process exits", async () => {
      const done = generatePuzzles(1, { difficulty: "hard" });
      proc.write(line("3", "99"));
      expect(workerEmit).not.toHaveBeenCalled();
      proc.exit(0);
      await done;
      expect(emitted()).toEqual([{ cells: CELLS, solvedCells: SOLVED, score: 99, rating: "hard" }]);
    });

    it("skips blank lines", async () => {
      const done = generatePuzzles(1, { difficulty: "easy" });
      proc.write(`\n  \n${line()}\n\n`);
      proc.exit(0);
      await done;
      expect(workerEmit).toHaveBeenCalledOnce();
    });

    it.each([
      ["0", "beginner"],
      ["1", "easy"],
      ["2", "medium"],
      ["3", "hard"],
    ])("maps rating %s to %s", async (num, rating) => {
      const done = generatePuzzles(1, { difficulty: "easy" });
      proc.write(`${line(num)}\n`);
      proc.exit(0);
      await done;
      expect(emitted()[0]).toMatchObject({ rating });
    });

    // Anything emitted is passed straight to createPuzzles by the service, so
    // a bad line must be dropped rather than emitted as undefined or saved.
    describe("malformed lines", () => {
      it.each([
        ["too few fields", `${CELLS}:${SOLVED}:42`],
        ["an empty field", `${CELLS}::42:1`],
        ["garbage", "Segmentation fault"],
      ])("does not emit a line with %s", async (_label, bad) => {
        const done = generatePuzzles(2, { difficulty: "easy" });
        proc.write(`${bad}\n${line()}\n`);
        proc.exit(0);
        await done;
        expect(emitted()).toEqual([{ cells: CELLS, solvedCells: SOLVED, score: 42, rating: "easy" }]);
      });

      it("does not emit a trailing malformed fragment", async () => {
        const done = generatePuzzles(1, { difficulty: "easy" });
        proc.write(`${line()}\n${CELLS}:${SOLVED}`);
        proc.exit(0);
        await done;
        expect(workerEmit).toHaveBeenCalledOnce();
      });

      it.each([
        ["cells that aren't 81 digits", line("1", "42", "0".repeat(80))],
        ["solved cells that aren't 81 digits", line("1", "42", CELLS, "x".repeat(81))],
        ["a non-numeric score", line("1", "lots")],
        ["an unknown rating", line("9")],
      ])("does not emit a puzzle with %s", async (_label, bad) => {
        const done = generatePuzzles(1, { difficulty: "easy" });
        proc.write(`${bad}\n`);
        proc.exit(0);
        await done;
        expect(workerEmit).not.toHaveBeenCalled();
      });
    });
  });

  describe("exit", () => {
    it("resolves when the generator exits with code 0", async () => {
      const done = generatePuzzles(1, { difficulty: "easy" });
      proc.exit(0);
      await expect(done).resolves.toBeUndefined();
    });

    it("rejects with a PuzzleGeneratorError on a non-zero exit code", async () => {
      const done = generatePuzzles(1, { difficulty: "easy" });
      proc.exit(1);
      const err = await done.catch((e: unknown) => e);
      expect(err).toBeInstanceOf(PuzzleGeneratorError);
      expect((err as Error).message).toBe(
        "Generator exited with code 1. Node signal: NULL. stderr: <empty>",
      );
    });

    it("includes the signal when the generator is killed", async () => {
      const done = generatePuzzles(1, { difficulty: "easy" });
      proc.exit(null, "SIGKILL");
      await expect(done).rejects.toThrow("Generator exited with code null. Node signal: SIGKILL");
    });

    it("still emits puzzles produced before a failed exit", async () => {
      const done = generatePuzzles(2, { difficulty: "easy" });
      proc.write(`${line()}\n`);
      proc.exit(1);
      await expect(done).rejects.toBeInstanceOf(PuzzleGeneratorError);
      expect(workerEmit).toHaveBeenCalledOnce();
    });

    describe("stderr", () => {
      it("includes the generator's stderr in the error", async () => {
        const done = generatePuzzles(1, { difficulty: "easy" });
        proc.writeErr(LOG_OPEN_FAILURE);
        proc.exit(1);
        await expect(done).rejects.toThrow(
          `Generator exited with code 1. Node signal: NULL. stderr: ${LOG_OPEN_FAILURE.trim()}`,
        );
      });

      it("joins stderr split across chunks", async () => {
        const done = generatePuzzles(1, { difficulty: "easy" });
        proc.writeErr("Failed to open ");
        proc.writeErr("file at: /sudoku/logs");
        proc.exit(1);
        await expect(done).rejects.toThrow("stderr: Failed to open file at: /sudoku/logs");
      });

      it("keeps only the end of very long stderr output", async () => {
        const done = generatePuzzles(1, { difficulty: "easy" });
        proc.writeErr("TRACE noise\n".repeat(1000));
        proc.writeErr("FATAL the real reason");
        proc.exit(1);
        const message = ((await done.catch((e: unknown) => e)) as Error).message;
        const stderr = message.split("stderr: ")[1]!;
        expect(stderr.length).toBeLessThanOrEqual(MAX_STDERR_CHARS);
        expect(stderr).toMatch(/FATAL the real reason$/);
      });

      it("does not fail a successful run that wrote to stderr", async () => {
        const done = generatePuzzles(1, { difficulty: "easy" });
        proc.writeErr("WARN something non-fatal\n");
        proc.write(`${line()}\n`);
        proc.exit(0);
        await expect(done).resolves.toBeUndefined();
        expect(workerEmit).toHaveBeenCalledOnce();
      });

      it("never parses stderr as puzzle output", async () => {
        const done = generatePuzzles(1, { difficulty: "easy" });
        proc.writeErr(`${line()}\n`);
        proc.exit(0);
        await done;
        expect(workerEmit).not.toHaveBeenCalled();
      });
    });

    it("rejects with the spawn error when the binary can't be started", async () => {
      const done = generatePuzzles(1, { difficulty: "easy" });
      const err = Object.assign(new Error("spawn ENOENT"), { code: "ENOENT" });
      proc.emit("error", err);
      await expect(done).rejects.toBe(err);
    });
  });
});
