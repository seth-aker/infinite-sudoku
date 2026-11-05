import { Router, Application } from "express";
import { AppRouter } from "@/app";
export const configureRouting = (app: Application, routers: AppRouter[] ) => {
  const router = Router();
  app.use("/api", router);
  routers.forEach((route => {
    router.use(route.path, route.router);
  }));
};
