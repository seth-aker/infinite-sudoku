import z from "zod/v4";
import { registerBodySchema } from "../middleware/validation";
import { IUserDTO } from "@/feature/users/datasource/models/user";

export interface AuthenticationService {
  verify: (username: string, password: string) => Promise<IUserDTO>;
  registerUser: (
    user: z.infer<typeof registerBodySchema>,
  ) => Promise<{ userId: string; accessToken: string; refreshToken: string }>;
  getNewTokenSet: (
    userId: string,
  ) => Promise<{ accessToken: string; refreshToken: string }>;
  refreshAccessToken: (
    refreshToken: string,
  ) => Promise<{ accessToken: string; refreshToken: string }>;
  clearRefreshToken: (token: string) => Promise<void>;
  requestPasswordResetToken: (email: string) => Promise<void>;
  resetPassword: (
    resetToken: string,
    newPassword: string,
  ) => Promise<{ accessToken: string; refreshToken: string }>;
  validateEmail: (token: string, email: string) => Promise<boolean>;
}
