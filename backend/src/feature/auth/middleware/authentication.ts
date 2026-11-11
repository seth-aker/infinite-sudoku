import { config } from "@/core/config";
import { NextFunction, Request, RequestHandler, Response } from "express";
import { JWTPayload, jwtVerify } from "jose";
import { AuthenticationError } from "../errors/authenticationError";
import { ErrorType } from "@/core/errors/errorTypes";
import { AuthorizationError } from "../errors/authorizationError";
import { JWTExpired } from "jose/errors";
import * as z from "zod/v4"
import { BadRequestError } from "@/core/errors/badRequestError";
export interface SudokuAppJwtPayload extends JWTPayload {
  emailVerified: boolean,
  role: "user" | "admin";
}
// Checks for access token and, if found, adds user data to the request object.
// DOES NOT prevent access to a route.
export const authenticate: RequestHandler = async (req, _res, next) => {
  const token = getToken(req);
  if (!token) {
    return next();
  }
  try {
    const secret = new TextEncoder().encode(config.jwtSecret);

    const { payload } = await jwtVerify(token, secret, {
      audience: config.audience,
      issuer: config.issuer,
      algorithms: ["HS256"],
    });
    req.user = payload as SudokuAppJwtPayload;
  } catch (err) {
    req.authError = err instanceof JWTExpired ? ErrorType.TOKEN_EXPIRED : ErrorType.TOKEN_INVALID
  }
  next();
}
export const requireLoggedin = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  if (!req.user) {
    throw new AuthenticationError(req.authError ? "Invalid access token" : "Missing access token", { type: req.authError ?? ErrorType.TOKEN_MISSING })
  }
  next();
};

export const requireAdmin = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) =>
  requireLoggedin(req, _res, () => {
    if (req.user!.role != "admin") {
      throw new AuthorizationError("Admin access required", {
        type: ErrorType.INSUFFICIENT_ROLE,
      });
    }
    next();
  });

export async function requireSelfOrAdmin(req: Request<{ id: string }>, _res: Response, next: NextFunction) {
  const userId = req.params.id;
  if (!z.uuid().safeParse(userId).success) {
    throw new BadRequestError("Invalid user id")
  }
  if (!req.user || !req.user?.sub) {
    throw new AuthenticationError("Missing access token",
      { type: ErrorType.TOKEN_MISSING })
  }
  if (req.user.sub !== userId && req.user.role !== 'admin') {
    throw new AuthorizationError("Admin access required", {
      type: ErrorType.INSUFFICIENT_ROLE,
    });
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
