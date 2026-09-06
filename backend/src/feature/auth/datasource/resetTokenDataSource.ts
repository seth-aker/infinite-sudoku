export type ResetTokenStatus = 'UNUSED' | 'USED';

interface ResetToken {
  token: string,
  userId: string,
  createdAt: Date,
}

export interface ResetTokenDataSource {
  createResetToken: (userId: string) => Promise<string>
  findByTokenAndStatus: (token: string, status: ResetTokenStatus) => Promise<ResetToken | undefined>
}
