import { beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "@/core/logging/logger";
import { expectLogged } from "#test/helpers/logger";
import { WorkerPoolError } from "@/core/errors/workerpoolError";
import { WorkerPoolManager } from "@/core/workers/workerpoolManager";
import type { WorkerPoolConfig } from "@/core/workers/workerpoolConfig";

// Stands in for workerpool so no worker processes are started. `exec`
// captures the `on` handler, letting tests play the worker's emitted events.
const { pool, exec } = vi.hoisted(() => {
  const exec = vi.fn();
  return { exec, pool: vi.fn(() => ({ exec })) };
});
vi.mock("workerpool", () => ({ default: { pool } }));

type ExecOptions = { on: (payload: unknown) => void };

const CONFIG: WorkerPoolConfig = {
  name: "puzzleGenerator",
  workerPath: "/worker/path.ts",
  options: { maxWorkers: 4 },
};
const ARGS = [100, { difficulty: "easy" }];

/** Lets the promise chain started inside the `on` handler run to completion. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

describe("WorkerPoolManager", () => {
  let manager: WorkerPoolManager;

  beforeEach(() => {
    manager = new WorkerPoolManager(CONFIG);
  });

  it("creates the pool from the configured worker path and options", () => {
    expect(pool).toHaveBeenCalledOnce();
    expect(pool).toHaveBeenCalledWith("/worker/path.ts", { maxWorkers: 4 });
  });

  describe("execute", () => {
    it("runs the named function with its args and returns the result", async () => {
      exec.mockResolvedValue("done");
      await expect(manager.execute("generatePuzzles", ARGS)).resolves.toBe("done");
      expect(exec).toHaveBeenCalledWith("generatePuzzles", ARGS, expect.anything());
    });

    it("reuses the pool across calls", async () => {
      exec.mockResolvedValue(undefined);
      await manager.execute("generatePuzzles", ARGS);
      await manager.execute("generatePuzzles", ARGS);
      expect(pool).toHaveBeenCalledOnce();
    });

    it("logs the call outside production", async () => {
      exec.mockResolvedValue(undefined);
      await manager.execute("generatePuzzles", ARGS);
      expectLogged("debug", expect.objectContaining({ functionName: "generatePuzzles" }));
    });

    it("does not log the call in production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      exec.mockResolvedValue(undefined);
      await manager.execute("generatePuzzles", ARGS);
      expect(logger.debug).not.toHaveBeenCalled();
    });

    describe("worker events", () => {
      // Emits `payloads` from the "worker" while exec is running.
      function workerEmits(...payloads: unknown[]) {
        exec.mockImplementation(async (_name, _args, { on }: ExecOptions) => {
          payloads.forEach((p) => on(p));
          return "done";
        });
      }

      it("passes each emitted payload to onUpdate", async () => {
        const onUpdate = vi.fn();
        workerEmits({ n: 1 }, { n: 2 });
        await manager.execute("generatePuzzles", ARGS, onUpdate);
        await settle();
        expect(onUpdate.mock.calls).toEqual([[{ n: 1 }], [{ n: 2 }]]);
      });

      it("ignores events when no onUpdate is given", async () => {
        workerEmits({ n: 1 });
        await expect(manager.execute("generatePuzzles", ARGS)).resolves.toBe("done");
      });

      // Workerpool calls `on` from its message handler, outside execute's
      // try/catch, so a failing handler would otherwise surface as an
      // unhandled rejection / uncaught exception and shut the server down.
      it.each([
        ["throws", () => { throw new Error("boom"); }],
        ["rejects", async () => { throw new Error("boom"); }],
      ])("logs instead of crashing when onUpdate %s", async (_label, onUpdate) => {
        workerEmits(undefined);
        await expect(manager.execute("generatePuzzles", ARGS, onUpdate)).resolves.toBe("done");
        await settle();
        expectLogged(
          "error",
          expect.objectContaining({ err: expect.objectContaining({ message: "boom" }) }),
        );
      });

      it("keeps handling later events after one fails", async () => {
        const onUpdate = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValue(undefined);
        workerEmits({ n: 1 }, { n: 2 });
        await manager.execute("generatePuzzles", ARGS, onUpdate);
        await settle();
        expect(onUpdate).toHaveBeenCalledTimes(2);
        expect(logger.error).toHaveBeenCalledOnce();
      });
    });

    describe("failures", () => {
      it("wraps a worker error in a WorkerPoolError with the same message", async () => {
        exec.mockRejectedValue(new Error("Generator exited with code 1"));
        const err = await manager.execute("generatePuzzles", ARGS).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(WorkerPoolError);
        expect((err as WorkerPoolError).message).toBe("Generator exited with code 1");
        expect((err as WorkerPoolError).statusCode).toBe(500);
      });

      it("keeps the original error as the cause", async () => {
        // Otherwise the worker's stack trace is lost from the logs.
        const original = new Error("Generator exited with code 1");
        exec.mockRejectedValue(original);
        const err = await manager.execute("generatePuzzles", ARGS).catch((e: unknown) => e);
        expect((err as Error).cause).toBe(original);
      });

      it("describes a non-Error rejection with the function name and value", async () => {
        exec.mockRejectedValue("worker terminated");
        const err = await manager.execute("generatePuzzles", ARGS).catch((e: unknown) => e);
        expect(err).toBeInstanceOf(WorkerPoolError);
        expect((err as Error).message).toMatch(/generatePuzzles/);
        expect((err as Error).message).toMatch(/Error: worker terminated$/);
      });
    });
  });
});
