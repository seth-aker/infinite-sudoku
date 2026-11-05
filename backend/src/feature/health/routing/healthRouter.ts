import { Router } from "express";
import { Sql } from "postgres";

export class HealthRouter {
  private client: Sql;
  public constructor(client: Sql) {
    this.client = client;
  }
  public setup() {
    const router = Router();
    router.get("/_health", async (_req, res) => {
      const [row] = await this.client<{ now: Date }[]>`SELECT NOW() as now`;
      if (row.now) {
        return res.sendStatus(200);
      } else {
        return res.sendStatus(500);
      }
    });
    return router;
  }
}
