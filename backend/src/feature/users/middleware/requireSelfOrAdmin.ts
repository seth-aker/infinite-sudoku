import { requireAdmin } from "@/feature/auth/middleware/authentication";
import { NextFunction, Request, Response } from "express";
import z from "zod";

export const requireSelfOrAdmin = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  const userId = req.params.id;
  if (!z.string().uuid().safeParse(userId).success) {
    return res.sendStatus(400);
  }
  if (!req.user?.userId) {
    return res.sendStatus(401);
  }
  if (req.user.userId !== userId) {
    return requireAdmin(req, res, next);
  }
  return next();
};
