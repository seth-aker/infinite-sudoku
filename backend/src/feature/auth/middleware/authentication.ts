import { config } from "@/core/config";
import { NextFunction, Request, Response } from "express";
import { JWTPayload, jwtVerify } from "jose";
import { AuthenticationError } from "../errors/authenticationError";
import { ErrorType } from "@/core/errors/errorTypes";
import { AuthorizationError } from "../errors/authorizationError";
import { CustomError } from "@/core/errors/customError";
import { JWTExpired } from "jose/errors";
import { logger } from "@/core/logging/logger";
import * as z from "zod/v4"
export interface SudokuAppJwtPayload extends JWTPayload {
  emailVerified: boolean,
  role: "user" | "admin";
}
export const requireLoggedin = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const token: string | undefined = getToken(req);

  if (!token) {
    throw new AuthenticationError("Missing Bearer token", {
      type: ErrorType.TOKEN_MISSING,
    });
  }
  try {
    const secret = new TextEncoder().encode(config.jwtSecret);

    const { payload } = await jwtVerify(token, secret, {
      audience: config.audience,
      issuer: config.issuer,
      algorithms: ["HS256"],
    });
    req.user = payload as SudokuAppJwtPayload;
    next();
  } catch (err) {
    logger.error(err)
    throw new AuthenticationError("Invalid access token", {
      type: err instanceof JWTExpired ? ErrorType.TOKEN_EXPIRED : ErrorType.TOKEN_INVALID,
    });
  }
};

export const requireAdmin = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const token: string | undefined = getToken(req);

  if (!token) {
    throw new AuthenticationError("Missing access token", {
      type: ErrorType.TOKEN_MISSING,
    });
  }
  try {
    const secret = new TextEncoder().encode(config.jwtSecret);

    const { payload } = await jwtVerify(token, secret, {
      issuer: config.issuer,
      audience: config.audience,
      algorithms: ["HS256"],
    });
    if ((payload as SudokuAppJwtPayload).role != "admin") {
      throw new AuthorizationError("Admin access required", {
        type: ErrorType.INSUFFICIENT_ROLE,
      });
    }

    req.user = payload as SudokuAppJwtPayload;
    next();
  } catch (err) {
    logger.error(err)
    if (err instanceof CustomError) throw err;
    throw new AuthenticationError("Invalid Bearer token", {
      type: err instanceof JWTExpired ? ErrorType.TOKEN_EXPIRED : ErrorType.TOKEN_INVALID,
    });
  }
};
export async function requireSelfOrAdmin(req: Request<{ id: string }>, res: Response, next: NextFunction) {
  const userId = req.params.id;
  if (!z.uuid().safeParse(userId).success) {
    res.sendStatus(400);
  }
  if (!req.user || !req.user.sub) {
    throw new AuthenticationError("Missing access token",
      { type: ErrorType.TOKEN_MISSING })
  }
  if (req.user.sub !== userId) {
    return requireAdmin(req, res, next);
  }
  return next();
}

function getToken(req: Request) {
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    return req.headers.authorization.split(" ")[1];
  } else {
    return req.cookies?.accessToken;
  }
}
