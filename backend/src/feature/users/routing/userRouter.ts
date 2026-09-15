import { Router, Request, Response } from "express";
import { UserService } from "../service/userService";
import { requireSelfOrAdmin } from "../middleware/requireSelfOrAdmin";
import { requireLoggedin } from "@/feature/auth/middleware/authentication";

export function UserRouter(userService: UserService) {
  const router = Router();
  // Must be first to get caught before /:id
  router.get("/me", requireLoggedin, async (req: Request, res: Response) => {
    const userId = req.user.userId;
    const user = await userService.getUser(userId);
    return res.send(JSON.stringify(user));
  });
  router.get(
    "/:id",
    requireLoggedin,
    requireSelfOrAdmin,
    async (req: Request<{ id: string }>, res) => {
      // get user
      const userId = req.params.id;
      const user = await userService.getUser(userId);
      return res.send(JSON.stringify(user));
    },
  );
  router.get(
    "/:id/stats",
    requireLoggedin,
    requireSelfOrAdmin,
    async (req: Request<{ id: string }>, res) => {
      const userId = req.params.id;
      const stats = await userService.getUserStats(userId);
      return res.json(JSON.stringify(stats));
    },
  );
  return router;
}
