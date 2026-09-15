import workerpool from "workerpool";
import { config as cf } from "@/core/config/index";
export interface WorkerPoolConfig {
  name: string;
  workerPath: string;
  options?: workerpool.WorkerPoolOptions;
}
const isDev = process.env.NODE_ENV === "development";

export const config: WorkerPoolConfig = {
  name: "puzzleGenerator",
  workerPath: cf.puzzleGeneratorWorkerPath,
  options: {
    maxWorkers: 4,
    workerType: isDev ? "process" : "thread",
    forkOpts: isDev
      ? {
          execArgv: ["--import", "tsx"],
        }
      : undefined,
  },
};
