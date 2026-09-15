import { Router, type Request } from "express";
import { AuthenticationService } from "../../service/authenticationService";
import { authLimiter } from "../../middleware/rateLimiter";
import { requireLoggedin } from "../../middleware/authentication";
import { clearAuthCookies } from "../../utils/cookies";
import {
  registerBodyValidator,
  tokenBodyValidator,
} from "../../middleware/validation";
import { DatabaseError } from "@/core/errors/databaseError";
import { AuthenticationError } from "../../errors/authenticationError";
import { ErrorType } from "@/core/errors/errorTypes";

type TokenPasswordBody = {
  grantType: "password";
  email: string;
  password: string;
};

type TokenRefreshBody = {
  grantType: "refreshToken";
  refreshToken: string;
};

export function MobileAuthRouter(authService: AuthenticationService) {
  const router = Router();

  router.post(
    "/login",
    authLimiter(),
    tokenBodyValidator,
    async (req: Request<{}, {}, TokenPasswordBody>, res) => {
      const user = await authService.verify(req.body.email, req.body.password);

      const { accessToken, refreshToken } = await authService.getNewTokenSet(
        user.id,
      );

      res.json({ accessToken, refreshToken, user });
      return;
    },
  );

  router.post("/logout", authLimiter(), requireLoggedin, async (req, res) => {
    const refreshToken = req.body.refreshToken;

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

      return res.status(201).json({
        user,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    },
  );

  router.post(
    "/refresh",
    authLimiter(),
    tokenBodyValidator,
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
  return router;
}
