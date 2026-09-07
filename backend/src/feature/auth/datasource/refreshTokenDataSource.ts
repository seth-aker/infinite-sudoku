export interface TokenRecord {
    user_id: string,
    expires_at: Date,
}

export interface RefreshTokenDataSource {
    close: () => void
    rotateRefreshToken: (token: string) => Promise<{token: string, userId: string}>
    create: (userId: string) => Promise<string>
    invalidateAllForUser: (userId: string) => Promise<void>
    delete: (token: string) => Promise<void>
}
