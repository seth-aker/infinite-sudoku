import express from 'express'
import { configureRouting } from "./core/routing/index";
import { config } from "./core/config/index";
import cors from 'cors'
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { sessionHandler } from './feature/auth/handler/sessionHandler';
import prexit from 'prexit';
const app = express();

app.use(express.json())

if(process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1)
  app.use(cors({
    origin: config.origin,
    credentials: true
  }))
  app.use(helmet())
  app.use(rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minute window
    limit: 100,
    standardHeaders: 'draft-8',
    legacyHeaders: false
  }))
} else {
  app.use(cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true
  }))
}

app.use(sessionHandler())
configureRouting(app)

const server = app.listen(config.port, () => {
  console.log('Sudoku app listening at:', config.port)
})

prexit(async () => {
  await new Promise(r => server.close(r))
})
