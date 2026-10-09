export interface ValidateTokenDataSource {
  createValidateToken: (email: string) => Promise<string>
  validateEmail: (token: string) => Promise<boolean>
} 
