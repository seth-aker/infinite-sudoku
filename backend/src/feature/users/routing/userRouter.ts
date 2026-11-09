import { Router, Request, Response } from "express";
import { UserService } from "../service/userService";
import { requireLoggedin, requireSelfOrAdmin } from "@/feature/auth/middleware/authentication";
import { AuthenticationError } from "@/feature/auth/errors/authenticationError";

export class UserRouter {
  private userService: UserService;
  public constructor(userService: UserService) {
    this.userService = userService;
  }
  public setup() {
    const router = Router();
    // Must be first to get caught before /:id
    router.get("/me", requireLoggedin, async (req: Request, res: Response) => {
      const userId = req.user?.sub;
      if(!userId) {
        throw new AuthenticationError("No user id found in access token");
      }
      const user = await this.userService.getUser(userId);
      return res.json({
        user
      })
    });
    router.get(
      "/:id",
      requireLoggedin,
      requireSelfOrAdmin,
      async (req: Request<{ id: string }>, res) => {
        // get user
        const userId = req.params.id;
        const user = await this.userService.getUser(userId);
        return res.json({
          user
        })
      },
    );
    router.get(
      "/:id/stats",
      requireLoggedin,
      requireSelfOrAdmin,
      async (req: Request<{ id: string }>, res) => {
        const userId = req.params.id;
        const stats = await this.userService.getUserStats(userId);
        return res.json({ stats })
      },
    );
    return router;
  }
}
