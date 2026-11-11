import workerpool from "workerpool";
import { WorkerPoolConfig } from "./workerpoolConfig";
import { WorkerPoolError } from "../errors/workerpoolError";
import { logger } from "../logging/logger";

export class WorkerPoolManager {
  // <functionName, argsTypes>
  private pool: workerpool.Pool;
  constructor(config: WorkerPoolConfig) {
    this.pool = workerpool.pool(config.workerPath, config.options);
  }
  async execute<T>(
    functionName: string,
    args: any[],
    onUpdate?: (data: any) => void | Promise<void>,
  ): Promise<T> {
    if (process.env.NODE_ENV !== "production") {
      logger.debug({ functionName, args }, "calling worker");
    }
    try {
      return await this.pool.exec(functionName, args, {
        on: (payload: any) => {
          if (!onUpdate) return;
          // enables the onUpdate callback to be caught and logged.
          Promise.resolve()
            .then(() => onUpdate(payload))
            .catch((err) => logger.error({ err, functionName }, "worker onUpdate handler failed"));
        },
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `An error occured executing ${functionName} with args ${(JSON.stringify(args))}. Error: ${String(error)}`;
      throw new WorkerPoolError(message, { cause: error });
    }
  }
}
