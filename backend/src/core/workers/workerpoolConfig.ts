import { type WorkerPoolOptions } from "workerpool";
export interface WorkerPoolConfig {
  name: string;
  workerPath: string;
  options?: WorkerPoolOptions;
}
