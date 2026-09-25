import { Sql } from "postgres";
import { ValidateTokenDataSource } from "./validateTokenDataSource";
import { NotFoundError } from "@/core/errors/notFoundError";

export class PgValidateTokenDataSource implements ValidateTokenDataSource {
  private static instance: PgValidateTokenDataSource | null = null;
  private client: Sql;

  private constructor(client: Sql) {
    this.client = client;
  }
  static create(client: Sql) {
    if (!PgValidateTokenDataSource.instance) {
      PgValidateTokenDataSource.instance = new PgValidateTokenDataSource(client);
    }
    return this.instance;
  }

  async createValidateToken(userId: string) {
    const [res] = await this.client<{ token: string }[]>`
      INSERT INTO validate_tokens 
        (user_id) 
      VALUES 
        (${userId})
      RETURNING token;
      `
    return res.token;
  }

  async validateEmail(token: string) {
    const updateRes = await this.client.begin(async sql => {
      const [res] = await sql<{ user_id: string }[]>`
        SELECT user_id
        FROM validate_tokens
        WHERE token = ${token}`
      if(!res?.user_id) {
        throw new NotFoundError('Account not found');
      }
      const updated = await sql`
        UPDATE users
        SET email_verified = true
        WHERE user_id = ${res.user_id}
      `
      if (updated.count != 1) {
        throw new NotFoundError('Account not found');
      }
      return await sql`
        DELETE FROM validate_tokens
        WHERE token = ${token}
      `
    })
    if (updateRes.count != 1) {
      return false;
    }
    return true;
  }
}
