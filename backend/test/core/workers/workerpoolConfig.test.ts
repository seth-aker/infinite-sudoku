import { beforeEach, describe, expect, it, vi } from "vitest";

async function load() {
  return (await import("@/core/workers/workerpoolConfig")).config;
}

describe("workerpool config", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("uses thread workers outside development", async () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(await load()).toEqual({
      name: "puzzleGenerator",
      workerPath: "/worker/path.ts",
      options: {
        maxWorkers: 4,
        workerType: "thread",
        forkOpts: undefined,
      },
    });
  });

  it("uses process workers with tsx in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(await load()).toEqual({
      name: "puzzleGenerator",
      workerPath: "/worker/path.ts",
      options: {
        maxWorkers: 4,
        workerType: "process",
        forkOpts: { execArgv: ["--import", "tsx"] },
      },
    });
  });
});
