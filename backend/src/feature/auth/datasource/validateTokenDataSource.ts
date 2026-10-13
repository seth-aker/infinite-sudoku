export interface ValidateTokenDataSource {
  createValidateToken: (userId: string) => Promise<string>
  validateEmail: (token: string) => Promise<boolean>
} 
