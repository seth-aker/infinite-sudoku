import { ErrorType } from "@/core/errors/errorTypes";
import { SudokuAppJwtPayload } from "@/feature/auth/middleware/authentication";

declare global {
  namespace Express {
    interface Request {
      id: string;
      user?: SudokuAppJwtPayload;
      authError?: ErrorType
    }
  }
}
