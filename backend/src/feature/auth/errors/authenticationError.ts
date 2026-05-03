import { CustomError } from "@/core/errors/customError";

export class AuthenticationError extends CustomError {
  constructor(message: string) {
    super()
    this.message = `[Authentication Error]: ${message}`
  }
  statusCode: number = 401
}