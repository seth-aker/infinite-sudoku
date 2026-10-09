import { RequestHandler } from "express";
import { NotFoundError } from "../errors/notFoundError";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`No route for ${req.method} ${req.originalUrl}`));
};
