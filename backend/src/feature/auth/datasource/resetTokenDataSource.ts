export type ResetTokenStatus = 'UNUSED' | 'USED';

interface ResetToken {
  token: string,
  userId: string,
  createdAt: Date,
}

export interface ResetTokenDataSource {
  createResetToken: (userId: string) => Promise<string>
  consumeToken: (token: string) => Promise<ResetToken | undefined>
}
