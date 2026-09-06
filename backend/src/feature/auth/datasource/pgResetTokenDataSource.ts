import { Sql } from "postgres";
import { ResetTokenDataSource, ResetTokenStatus } from "./resetTokenDataSource";
import { NotFoundError } from "@/core/errors/notFoundError";

export class PgResetTokenDataSource implements ResetTokenDataSource {
  static instance: PgResetTokenDataSource | null = null;
  private client: Sql;
  private constructor(client: Sql) {
    this.client = client;
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

  async findByTokenAndStatus(token: string, status: ResetTokenStatus) {
    const res = await this.client<{reset_token: string, user_id: string, created_at: Date}[]>`
      SELECT 
	reset_token,
	user_id,
	created_at
      FROM reset_tokens
      WHERE reset_token = ${token} AND status = ${status};
    `
    if(res.length != 1) throw new NotFoundError("Invalid token", {type: 'token_invalid'})
    return {
      userId: res[0].user_id,
      token: res[0].reset_token,
      createdAt: res[0].created_at
    };
  }
}
