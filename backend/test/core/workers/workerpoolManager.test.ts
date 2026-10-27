import { beforeEach, describe, expect, it, vi } from "vitest";
import workerpool from "workerpool";
import { WorkerPoolManager } from "@/core/workers/workerpoolManager";
import { config as defaultConfig } from "@/core/workers/workerpoolConfig";
import { WorkerPoolError } from "@/core/errors/workerpoolError";

const { exec } = vi.hoisted(() => ({ exec: vi.fn() }));

vi.mock("workerpool", () => ({
  default: { pool: vi.fn(() => ({ exec })) },
}));

describe("WorkerPoolManager", () => {
  beforeEach(() => {
    exec.mockResolvedValue("result");
  });

  describe("configure", () => {
    it("creates a pool from the provided config", () => {
      const manager = new WorkerPoolManager();
      const options = { maxWorkers: 1 };
      manager.configure({ name: "custom", workerPath: "/custom.ts", options });
      expect(workerpool.pool).toHaveBeenCalledWith("/custom.ts", options);
    });

    it("reuses the configured pool on execute", async () => {
      const manager = new WorkerPoolManager();
      manager.configure({ name: "custom", workerPath: "/custom.ts" });
      await manager.execute("fn", []);
      await manager.execute("fn", []);
      expect(workerpool.pool).toHaveBeenCalledTimes(1);
    });
  });

  describe("execute", () => {
    it("lazily creates a pool from the default config", async () => {
      const manager = new WorkerPoolManager();
      expect(workerpool.pool).not.toHaveBeenCalled();
      await manager.execute("fn", []);
      expect(workerpool.pool).toHaveBeenCalledWith(
        defaultConfig.workerPath,
        defaultConfig.options,
      );
      await manager.execute("fn", []);
      expect(workerpool.pool).toHaveBeenCalledTimes(1);
    });

    it("executes the function with args and resolves its result", async () => {
      const manager = new WorkerPoolManager();
      await expect(manager.execute("generate", [1, "a"])).resolves.toBe(
        "result",
      );
      expect(exec).toHaveBeenCalledWith("generate", [1, "a"], {
        on: expect.any(Function),
      });
    });

    it("forwards worker events to onUpdate", async () => {
      const onUpdate = vi.fn();
      exec.mockImplementationOnce(async (_fn, _args, opts) => {
        opts.on({ n: 1 });
        opts.on({ n: 2 });
        return "done";
      });
      const manager = new WorkerPoolManager();
      await manager.execute("fn", [], onUpdate);
      expect(onUpdate.mock.calls).toEqual([[{ n: 1 }], [{ n: 2 }]]);
    });

    it("ignores worker events when no onUpdate is given", async () => {
      exec.mockImplementationOnce(async (_fn, _args, opts) => {
        expect(() => opts.on("payload")).not.toThrow();
        return "done";
      });
      await new WorkerPoolManager().execute("fn", []);
    });

    it("wraps Error rejections in WorkerPoolError", async () => {
      exec.mockRejectedValueOnce(new Error("worker crashed"));
      const err = await new WorkerPoolManager()
        .execute<string>("fn", [])
        .catch((e) => e);
      expect(err).toBeInstanceOf(WorkerPoolError);
      expect(err.message).toBe("worker crashed");
    });

    it("wraps non-Error rejections in WorkerPoolError", async () => {
      exec.mockRejectedValueOnce("timeout");
      const err = await new WorkerPoolManager()
        .execute<string>("generate", [])
        .catch((e) => e);
      expect(err).toBeInstanceOf(WorkerPoolError);
      expect(err.message).toBe("An error occured executing generate: timeout");
    });

    it("logs the call in development", async () => {
      vi.stubEnv("NODE_ENV", "development");
      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      await new WorkerPoolManager().execute("generate", []);
      expect(log).toHaveBeenCalledWith("Calling generate");
    });

    it("does not log outside development", async () => {
      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      await new WorkerPoolManager().execute("generate", []);
      expect(log).not.toHaveBeenCalled();
    });
  });
});
