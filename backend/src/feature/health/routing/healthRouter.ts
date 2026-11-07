import { Router } from "express";
import { Sql } from "postgres";
import { logger } from "@/core/logging/logger";

// Exempted from the global rate limiter in createApp.
export const HEALTH_CHECK_PATH = "/api/_health";

const DEFAULT_TIMEOUT_MS = 2_000;

export class HealthRouter {
  private client: Sql;
  private timeoutMs: number;
  public constructor(client: Sql, timeoutMs = DEFAULT_TIMEOUT_MS) {
    this.client = client;
    this.timeoutMs = timeoutMs;
  }
  public setup() {
    const router = Router();
    router.get("/_health", async (_req, res) => {
      res.sendStatus((await this.isDatabaseUp()) ? 200 : 503);
    });
    return router;
  }

  private async isDatabaseUp() {
    const query = this.client<{ now: Date }[]>`SELECT NOW() as now`;
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        query.cancel();
        reject(new Error(`Database query timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);
    });

    try {
      const [row] = await Promise.race([query, timeout]);
      return Boolean(row?.now);
    } catch (err) {
      logger.warn({ err }, "health check failed");
      return false;
    } finally {
      clearTimeout(timer);
    }
  }
}
