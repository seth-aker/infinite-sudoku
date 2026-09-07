import { config } from "@/core/config";
import { NextFunction, Request, Response } from "express"
import { JWTPayload, jwtVerify } from "jose";
import { AuthenticationError } from "../errors/authenticationError";
import { ErrorType } from "@/core/errors/errorTypes";
import { AuthorizationError } from "../errors/authorizationError";
import { CustomError } from "@/core/errors/customError";

export interface SudokuAppJwtPayload extends JWTPayload {
    userId: string, 
    username: string,
    role: 'user' | 'admin',
}
export const requireLoggedin = async (req: Request, _res: Response, next: NextFunction) => {
  const token: string | undefined  = getToken(req);

  if(!token) {
    throw new AuthenticationError("Missing Bearer token", {type: ErrorType.TOKEN_MISSING })
  }
  try {
    const secret = new TextEncoder().encode(config.jwtSecret)

    const { payload } = await jwtVerify(token, secret, {
        audience: config.audience,
        issuer: config.issuer,
        algorithms: ['HS256']
    });

    req.user = payload as SudokuAppJwtPayload;
    next();
  } catch (err) {
    throw new AuthenticationError("Invalid access token", {type: ErrorType.TOKEN_INVALID } )
  }
}

export const requireAdmin = async (req: Request, _res: Response, next: NextFunction) => {
  const token: string | undefined = getToken(req);

  if(!token) {
    throw new AuthenticationError("Missing access token", {type: ErrorType.TOKEN_MISSING })
  }
  try {
    const secret = new TextEncoder().encode(config.jwtSecret);

    const { payload } = await jwtVerify(token, secret, {
        issuer: config.issuer,
        audience: config.audience,
        algorithms: ['HS256'],
    })
    if((payload as SudokuAppJwtPayload).role != 'admin') {
      throw new AuthorizationError("Admin access required", { type: ErrorType.INSUFFICIENT_ROLE })
    }

    req.user = payload as SudokuAppJwtPayload;
    next()
  } catch (err) {
    if(err instanceof CustomError) throw err;
    throw new AuthenticationError("Invalid Bearer token", {type: ErrorType.TOKEN_INVALID })
  }
}

function getToken(req: Request) {
    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      return req.headers.authorization.split(' ')[1];
    } else {
      return req.cookies?.accessToken;
  }
}
