import { Sql } from "postgres";
import { ValidateTokenDataSource } from "./validateTokenDataSource";
import { NotFoundError } from "@/core/errors/notFoundError";
import { DatabaseError } from "@/core/errors/databaseError";
import { AuthenticationError } from "../errors/authenticationError";
import { ErrorType } from "@/core/errors/errorTypes";
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
export class PgValidateTokenDataSource implements ValidateTokenDataSource {
  static instance: PgValidateTokenDataSource | null = null;
  private client: Sql;

  private constructor(client: Sql) {
    this.client = client;
  }
  static create(client: Sql) {
    if (!PgValidateTokenDataSource.instance) {
      PgValidateTokenDataSource.instance = new PgValidateTokenDataSource(client);
    }
    return PgValidateTokenDataSource.instance;
  }

  async createValidateToken(userId: string) {
    const [res] = await this.client<{ token: string }[]>`
      INSERT INTO validate_tokens 
        (user_id) 
      VALUES 
        (${userId})
      RETURNING token;
      `
    if (!res) {
      throw new DatabaseError("INSERT INTO validate_tokens returned no rows")
    }
    return res.token;
  }

  async validateEmail(token: string) {
    const updateRes = await this.client.begin(async sql => {
      const [res] = await sql<{ user_id: string, created_at: Date }[]>`
        SELECT user_id, created_at
        FROM validate_tokens
        WHERE token = ${token}`
      if (!res?.user_id) {
        throw new NotFoundError('Account not found');
      }
      if(!res?.created_at || (res?.created_at && res.created_at.getTime() + TWENTY_FOUR_HOURS_MS < Date.now())) {
        throw new AuthenticationError("Token expired", { type: ErrorType.TOKEN_EXPIRED })
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
