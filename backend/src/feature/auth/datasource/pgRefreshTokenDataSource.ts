import { Sql } from "postgres";
import { RefreshTokenDataSource, TokenRecord } from "./refreshTokenDataSource";
import { createHash, randomBytes } from 'node:crypto'
import { AuthenticationError } from "../errors/authenticationError";
import { ErrorType } from "@/core/errors/errorTypes";
import { logger } from "@/core/logging/logger";

export class PgRefreshTokenDataSource implements RefreshTokenDataSource {
    static instance: PgRefreshTokenDataSource | null = null;
    private client: Sql;
    private ONE_DAY_MS = 1000 * 60 * 60 * 24; 
    private THIRTY_DAY_MS = this.ONE_DAY_MS * 30;
    private CLEAR_INTERVAL = 1000 * 60 * 15 // 15 minutes

    private timer: NodeJS.Timeout;
    private constructor(client: Sql) {
        this.client = client
        this.timer = setInterval(async () => {
            try {
                await this.client`
                    DELETE FROM refresh_tokens WHERE expires_at < now()
                `
            } catch (err) {
                logger.error({err}, 'refresh token sweep failed');
            }
        }, this.CLEAR_INTERVAL)
        this.timer.unref()
    }

    public close() {
        clearInterval(this.timer)
    }

    static create(client: Sql) {
        if(!PgRefreshTokenDataSource.instance) {
            PgRefreshTokenDataSource.instance = new PgRefreshTokenDataSource(client);
        }
        return PgRefreshTokenDataSource.instance
    }
    public async rotateRefreshToken(token: string) {
        const expiresAt = Math.ceil((Date.now() + this.THIRTY_DAY_MS) / 1000); // postgres to_timestamp takes seconds as its argument
        const hashedOld = this.hashToken(token);
        const newToken = randomBytes(40).toString('hex');
        const hashedNew = this.hashToken(newToken);

        return await this.client.begin(async (sql) => {
            const [consumed] = await sql<TokenRecord[]>`
                DELETE FROM refresh_tokens 
                WHERE token = ${hashedOld}
                RETURNING user_id, expires_at
            `;
            if(!consumed) {
                throw new AuthenticationError('Refresh token is invalid', {
                    type: ErrorType.TOKEN_INVALID
                })
            }
            if(new Date() > consumed.expires_at) {
                throw new AuthenticationError('Refresh token expired. Please log in again.', {
                    type: ErrorType.TOKEN_EXPIRED
                })
            }

            await sql`
                INSERT INTO refresh_tokens (
                    user_id,
                    token,
                    expires_at
                )
                VALUES (
                    ${consumed.user_id},
                    ${hashedNew},
                    to_timestamp(${expiresAt})
                )
            `
            return { token: newToken, userId: consumed.user_id };
        })
    }
    public async create(userId: string) {
        const expiresAt = Math.ceil((Date.now() + this.THIRTY_DAY_MS) / 1000); // postgres to_timestamp takes seconds as its argument
        const token = randomBytes(40).toString('hex');
        const hashedToken = this.hashToken(token);
        await this.client`
            INSERT INTO refresh_tokens (
                user_id,
                token,
                expires_at
            ) 
            VALUES (
                ${userId},
                ${hashedToken},
                to_timestamp(${expiresAt})
            );
        `
        return token;
    }
    public async invalidateAllForUser(userId: string) {
      await this.client`
	DELETE FROM refresh_tokens
	WHERE user_id = ${userId};
      `
    }
    public async delete(token: string) {
        const hashedToken = this.hashToken(token);
        await this.client`
            DELETE FROM refresh_tokens 
            WHERE token = ${hashedToken};
        `
    }

    private hashToken(token: string) {
        return createHash('sha256')
            .update(token)
            .digest('hex')
    }
}
