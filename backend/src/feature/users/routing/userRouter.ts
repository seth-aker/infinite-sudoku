import { Router, Request } from "express";
import { UserService } from "../service/userService";
import { requireSelfOrAdmin } from "../middleware/requireSelfOrAdmin";

export function UserRouter(userService: UserService) {
  const router = Router()

  router.get('/:id', 
    requireSelfOrAdmin,
    async (req: Request<{id: string}>, res) => {
      // get user
      const userId = req.params.id;
      const user = await userService.getUser(userId)
      return res.send(JSON.stringify(user))
    }
  )
  router.get('/:id/stats',
    requireSelfOrAdmin,
    async (req: Request<{id: string}>, res) => {
      const userId = req.params.id;
      const stats = await userService.getUserStats(userId)
      return res.json(JSON.stringify(stats))
    }
  )
  return router
}
