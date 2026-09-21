import { Router, Request } from "express";
import {
  loginBodyValidator,
  registerBodyValidator,
} from "../../middleware/validation";
import { AuthenticationService } from "../../service/authenticationService";
import { authLimiter, resetPasswordRateLimiter } from "../../middleware/rateLimiter";
import { clearAuthCookies, setAuthCookies } from "../../utils/cookies";
import { DatabaseError } from "@/core/errors/databaseError";
import { requireLoggedin } from "../../middleware/authentication";
import { ErrorType } from "@/core/errors/errorTypes";
import { GenericError } from "@/core/errors/genericError";
import { ResetPasswordBody } from "../types";

export function WebAuthRouter(authService: AuthenticationService) {
  const router = Router();

  router.post(
    "/login",
    authLimiter(),
    loginBodyValidator,
    async (req, res, _next) => {
      const user = await authService.verify(req.body.email, req.body.password);

      const { accessToken, refreshToken } = await authService.getNewTokenSet(
        user.id,
      );

      setAuthCookies(res, accessToken, refreshToken);

      res.json({ user });
    },
  );

  router.post("/logout", authLimiter(), requireLoggedin, async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;

    if (refreshToken) {
      await authService.clearRefreshToken(refreshToken);
    }

    clearAuthCookies(res);

    res.sendStatus(204);
  });

  router.post(
    "/register",
    authLimiter(),
    registerBodyValidator,
    async (req, res, _next) => {
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
        accessToken: result.accessToken,
      });
    },
  );

  router.post("/refresh", authLimiter(), async (req, res) => {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(401).send({ error: "Refresh token required" });
    }
    const { accessToken, refreshToken: newRefreshToken } =
      await authService.refreshAccessToken(refreshToken);

    setAuthCookies(res, accessToken, newRefreshToken);
    res.sendStatus(201);
  });

  router.post(
    "/resetPassword",
    authLimiter(),
    resetPasswordRateLimiter,
    async (req: Request<{},{}, ResetPasswordBody>, res, _next) => {
      const resetToken = req.body.token;
      const password = req.body.password;
      if(!resetToken || !password) {
        throw new GenericError("Missing required field in request body", {type: ErrorType.MALFORMED_BODY });
      }
      const { accessToken, refreshToken } = await authService.resetPassword(resetToken, password);
      setAuthCookies(res, accessToken, refreshToken);
      res.sendStatus(200);
    }
  )

  return router;
}
