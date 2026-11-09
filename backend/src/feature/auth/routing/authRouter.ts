import { Router, Request, Response } from "express";
import { MobileAuthRouter } from "./mobile/mobileAuthrouter.ts";
import {
  resetRequestValidator,
  validateEmailTokenValidator,
} from "../middleware/validation.ts";
import { WebAuthRouter } from "./web/webAuthRouter.ts";
import { AuthenticationService } from "../service/authenticationService.ts";
import { tokenRequestRateLimiter } from "../middleware/rateLimiter.ts";

export class AuthRouter {
  private authService: AuthenticationService;
  public constructor(authService: AuthenticationService,) {
    this.authService = authService;
  }
  public setup(): Router {
    const router = Router();
    const mobileAuthRouter = MobileAuthRouter(this.authService);
    const webAuthRouter = WebAuthRouter(this.authService);
    router.use("/mobile", mobileAuthRouter);
    router.use("/web", webAuthRouter);

    router.post(
      "/resetPasswordToken",
      tokenRequestRateLimiter,
      resetRequestValidator,
      async (req: Request<{}, {}, { email: string }>, res: Response) => {
        await this.authService.requestPasswordResetToken(req.body.email);
        return res.sendStatus(204);
      },
    );
    router.post(
      '/validateEmail',
      validateEmailTokenValidator,
      async (req: Request<{}, {}, {}, { token: string }>, res) => {
        const token = req.query.token;
        const validated = await this.authService.validateEmail(token)
        if (!validated) {
          return res.sendStatus(404);
        }
        return res.sendStatus(204);
      })

    router.post(
      '/requestEmailVerification',
      tokenRequestRateLimiter,
      resetRequestValidator,
      async (req: Request<{}, {}, { email: string }>, res: Response) => {
        await this.authService.requestEmailVerification(req.body.email);
        return res.sendStatus(204)
      }
    )
    return router;

  }
}
