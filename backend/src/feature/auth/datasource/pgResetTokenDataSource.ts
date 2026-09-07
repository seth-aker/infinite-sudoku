import { Sql } from "postgres";
import { ResetTokenDataSource } from "./resetTokenDataSource";
import { logger } from "@/core/logging/logger";
export class PgResetTokenDataSource implements ResetTokenDataSource {
  static instance: PgResetTokenDataSource | null = null;
  private client: Sql;
  private timer: NodeJS.Timeout;
  private CLEAR_INTERVAL = 1000 * 60 * 15; // 15 minutes
  private constructor(client: Sql) {
    this.client = client;
    this.timer = setInterval(async () => {
      try {
	  await this.client`
	      DELETE FROM reset_tokens WHERE created_at + INTERVAL '15 minutes' < now()
	  `
      } catch (err) {
	  logger.error({err}, 'refresh token sweep failed');
      }
    }, this.CLEAR_INTERVAL)
    this.timer.unref()
  }
  static create(client: Sql) {
    if(!PgResetTokenDataSource.instance) {
      PgResetTokenDataSource.instance = new PgResetTokenDataSource(client);
    }
    return PgResetTokenDataSource.instance;
  }
  
  async createResetToken(userId: string) {
    const [res] = await this.client<{reset_token: string}[]>`
      INSERT INTO reset_tokens
	(user_id)
      VALUES 
	(${userId})
      RETURNING reset_token;
    `
    return res.reset_token;
  }

  async consumeToken(token: string) {
    const res = await this.client<{reset_token: string, user_id: string, created_at: Date}[]>`
      UPDATE reset_tokens
      SET status = 'USED'
      WHERE reset_token = ${token} AND status = 'UNUSED'
      RETURNING
	user_id,
	reset_token,
	created_at;
    `
    if(res.length != 1) return undefined; 
    return {
      userId: res[0].user_id,
      token: res[0].reset_token,
      createdAt: res[0].created_at
    };
  }
}
