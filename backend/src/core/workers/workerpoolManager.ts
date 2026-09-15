import workerpool from "workerpool";
import { WorkerPoolConfig, config } from "./workerpoolConfig";
import { WorkerPoolError } from "../errors/workerpoolError";

export class WorkerPoolManager {
  // <functionName, argsTypes>
  private pool: workerpool.Pool | null = null;
  private config: WorkerPoolConfig = config;
  configure(config: WorkerPoolConfig) {
    this.config = { ...this.config, ...config };
    this.pool = workerpool.pool(config.workerPath, config.options);
  }
  async execute<T>(
    functionName: string,
    args: any[],
    onUpdate?: (data: any) => void,
  ): Promise<T> {
    if (process.env.NODE_ENV === "development") {
      console.log(`Calling ${functionName}`);
    }
    if (!this.pool) {
      this.pool = workerpool.pool(this.config.workerPath, this.config.options);
    }
    try {
      return await this.pool.exec(functionName, args, {
        on: (payload: any) => {
          if (onUpdate) {
            onUpdate(payload);
          }
        },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `An error occured executing ${functionName}: ${String(error)}`;
      throw new WorkerPoolError(message);
    }
  }
}
