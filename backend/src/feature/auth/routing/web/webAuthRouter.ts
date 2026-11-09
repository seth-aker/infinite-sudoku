import { Router, Request, Response, NextFunction } from "express";
import {
  loginBodyValidator,
  passwordResetValidator,
  registerBodyValidator,
} from "../../middleware/validation";
import { AuthenticationService } from "../../service/authenticationService";
import { passwordGrantLimiter, refreshGrantLimiter, resetPasswordRateLimiter } from "../../middleware/rateLimiter";
import { clearAuthCookies, setAuthCookies } from "../../utils/cookies";
import { DatabaseError } from "@/core/errors/databaseError";
import { ResetPasswordBody } from "../types";
import { AuthenticationError } from "../../errors/authenticationError";
import { ErrorType } from "@/core/errors/errorTypes";

export function WebAuthRouter(authService: AuthenticationService) {
  const router = Router();

  router.post(
    "/login",
    passwordGrantLimiter,
    loginBodyValidator,
    async (req: Request, res: Response, _next: NextFunction) => {
      const user = await authService.verify(req.body.email, req.body.password);

      const { accessToken, refreshToken } = await authService.getNewTokenSet(
        user.id,
      );

      setAuthCookies(res, accessToken, refreshToken);

      res.json({ user });
    },
  );

  router.post("/logout", async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken) {
      await authService.clearRefreshToken(refreshToken);
    }

    clearAuthCookies(res);

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
      setAuthCookies(res, result.accessToken, result.refreshToken);
      return res.status(201).json({
        user,
      });
    },
  );

  router.post("/refresh", refreshGrantLimiter, async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      throw new AuthenticationError("Refresh token required", {
        type: ErrorType.TOKEN_MISSING,
      })
    }
    const { accessToken, refreshToken: newRefreshToken } =
      await authService.refreshAccessToken(refreshToken);

    setAuthCookies(res, accessToken, newRefreshToken);
    res.sendStatus(200);
  });

  router.post(
    "/resetPassword",
    resetPasswordRateLimiter,
    passwordResetValidator,
    async (req: Request<{}, {}, ResetPasswordBody>, res, _next) => {
      const resetToken = req.body.token;
      const password = req.body.password;
      await authService.resetPassword(resetToken, password);
      clearAuthCookies(res);
      res.sendStatus(200);
    }
  )

  return router;
}
