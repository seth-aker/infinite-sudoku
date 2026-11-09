import { NextFunction, Response, Router, type Request } from "express";
import { AuthenticationService } from "../../service/authenticationService";
import { passwordGrantLimiter, refreshGrantLimiter, resetPasswordRateLimiter } from "../../middleware/rateLimiter";
import {
  passwordResetValidator,
  registerBodyValidator,
  mobileLoginBodyValidator,
  mobileRefreshBodyValidator,
} from "../../middleware/validation";
import { DatabaseError } from "@/core/errors/databaseError";
import { AuthenticationError } from "../../errors/authenticationError";
import { ErrorType } from "@/core/errors/errorTypes";
import { TokenPasswordBody, TokenRefreshBody, ResetPasswordBody } from "../types";


export function MobileAuthRouter(authService: AuthenticationService) {
  const router = Router();

  router.post(
    "/login",
    passwordGrantLimiter,
    mobileLoginBodyValidator,
    async (req: Request<{}, {}, TokenPasswordBody>, res: Response) => {
      const user = await authService.verify(req.body.email, req.body.password);

      const { accessToken, refreshToken } = await authService.getNewTokenSet(
        user.id,
      );

      res.json({ accessToken, refreshToken, user });
      return;
    },
  );

  router.post("/logout", async (req, res) => {
    const refreshToken = req.body?.refreshToken;

    if (refreshToken && typeof refreshToken === 'string') {
      await authService.clearRefreshToken(refreshToken);
    }
    res.sendStatus(204);
  });

  router.post(
    "/register",
    passwordGrantLimiter,
    registerBodyValidator,
    async (req: Request, res: Response, _next: NextFunction) => {
      const result = await authService.registerUser(req.body);
      if (!result.userId) {
        throw new DatabaseError("An error occured registering the user");
      }
      const user = {
        id: result.userId,
        email: req.body.email,
        emailVerified: false,
        username: req.body.username,
        role: "user",
      };

      return res.status(201).json({
        user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    },
  );

  router.post(
    "/refresh",
    refreshGrantLimiter,
    mobileRefreshBodyValidator,
    async (req: Request<{}, {}, TokenRefreshBody>, res, _next) => {
      const refreshToken = req.body.refreshToken;
      if (!refreshToken) {
        throw new AuthenticationError("Missing or invalid refresh token.", {
          type: ErrorType.TOKEN_MISSING,
        });
      }
      const { accessToken, refreshToken: newRefreshToken } =
        await authService.refreshAccessToken(refreshToken);

      return res.json({ accessToken, refreshToken: newRefreshToken });
    },
  );

  router.post(
    "/resetPassword",
    resetPasswordRateLimiter,
    passwordResetValidator,
    async (req: Request<{}, {}, ResetPasswordBody>, res, _next) => {
      const resetToken = req.body.token;
      const password = req.body.password;
      await authService.resetPassword(resetToken, password);
      return res.sendStatus(200);
    }
  )
  return router;
}
