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

  async createValidateToken(email: string) {
    const [res] = await this.client<{ token: string }[]>`
      INSERT INTO validate_tokens 
        (user_email) 
      VALUES 
        (${email})
      RETURNING token;
      `
    return res.token;
  }

  async validateEmail(token: string) {
    const [res] = await this.client<{ user_email: string }[]>`
        SELECT user_email
        FROM validate_tokens
        WHERE token = ${token}
    `
    const updateRes = await this.client.begin(async sql => {
      const updated = await sql`
        UPDATE users
        SET email_verified = true
        WHERE email = ${res.user_email}
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
