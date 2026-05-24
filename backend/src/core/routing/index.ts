import { Router, Application } from "express";
import { sudokuRouter } from "../../feature/sudoku/routing/index";
import { authRouter } from "@/feature/auth/routing";
import { userRouter } from "@/feature/users/routing";
import sql from "@/core/dataSource/postgres"
export const configureRouting = (app: Application) => {
  const router = Router()
  app.use('/api', router)
  // app.use('/ping', (req, res) => res.send('Pong'))
  router.use('/sudoku', sudokuRouter)
  router.use('/auth', authRouter)
  router.use('/users', userRouter)
  router.get('/_health', async (_req, res) => {
    const [row] = await sql<{now: Date }[]>`SELECT NOW() as now`
    if(row.now) {
      return res.sendStatus(200)
    }
    else {
      return res.sendStatus(500)
    }
  })
}
