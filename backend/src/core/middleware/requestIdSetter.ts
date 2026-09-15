import { Request, RequestHandler } from "express";
import { randomUUID } from "node:crypto";

const SAFE_ID = /^[A-Za-z0-9-]{1,64}$/;

export const requestIdSetter: RequestHandler = (req: Request, res, next) => {
  const inbound = req.get("x-request-id");
  req.id = inbound && SAFE_ID.test(inbound) ? inbound : randomUUID();
  res.setHeader("x-request-id", req.id);
  next();
};
