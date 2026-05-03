import { CustomError } from "@/core/errors/customError";

export class AuthorizationError extends CustomError {
    constructor(message: string) {
        super()
        this.message = `[Authorization Error] ${message}`
    }
    statusCode: number = 403;
}