import express from 'express'
import { configureRouting } from "./core/routing/index";
import { config } from "./core/config/index";
import cors from 'cors'
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
const app = express();

app.use(express.json())
app.use(cors({
  origin: config.origin
}))
app.use(helmet())
app.set('trust proxy', 1)
app.use(rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minute window
  limit: 100,
  standardHeaders: 'draft-8',
  legacyHeaders: false
}))
configureRouting(app)

app.listen(config.port, () => {
  console.log('Sudoku app listening at:', config.port)
})
