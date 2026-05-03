import { Router, Request } from "express";
import { UserService } from "../service/userService";
import { requireLoggedin } from "@/feature/auth/middleware/validation";
import { requireSelfOrAdmin } from "../middleware/requireSelfOrAdmin";

export function UserRouter(userService: UserService) {
  const router = Router()

  router.get("/me", requireLoggedin, async (req, res, next) => {
    const userId = req.session.user!.id // requireLoggedIn ensures this exists
    const user = await userService.getUser(userId);
    return res.status(200).json(user)
  })

  router.get('/:id', 
    requireSelfOrAdmin,
    async (req: Request<{id: string}>, res, next) => {
      // get user
      const userId = req.params.id;
      const user = await userService.getUser(userId)
      return res.send(JSON.stringify(user))
    }
  )
  return router
}
