import { NextFunction, Request, Response } from "express";
import * as z from "zod/v4";

const passwordRegex =
  /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$ %^&*-]).{8,}$/;

const passwordSchema = z
  .string()
  .refine(
    (pw) => passwordRegex.test(pw),
    "Password must contain a minimum of 8 characters, one uppercase, one lowercase, one number, and one special character",
  );

const mobileLoginBodySchema = z.object({
  email: z.string().min(4),
  password: z.string().min(4),
});
const mobileRefreshBodySchema = z.object({
  refreshToken: z.string().min(1),
});
const loginBodySchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export const registerBodySchema = z.object({
  email: z.email(),
  username: z.string().min(4),
  password: passwordSchema,
  tosAcknowledged: z.boolean(),
});

export const loginBodyValidator = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const validationResult = loginBodySchema.safeParse(req.body);
  if (!validationResult.success) {
    throw validationResult.error;
  }
  next();
};

export const registerBodyValidator = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const validationResult = registerBodySchema.safeParse(req.body);
  if (!validationResult.success) {
    throw validationResult.error;
  }
  next();
};

export const mobileLoginBodyValidator = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const result = mobileLoginBodySchema.safeParse(req.body);
  if (!result.success) return next(result.error);
  req.body = result.data;
  next();
};

export const mobileRefreshBodyValidator = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const result = mobileRefreshBodySchema.safeParse(req.body);
  if (!result.success) return next(result.error);
  req.body = result.data;
  next();
}

export const resetRequestValidator = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const result = z.email().safeParse(req.body?.email);
  if (!result.success) {
    return next(result.error);
  }
  next();
};
export const passwordResetValidator = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const pwResult = passwordSchema.safeParse(req.body?.password);
  if (!pwResult.success) return next(pwResult.error);
  const tokenResult = z.uuid().safeParse(req.body?.token);
  if (!tokenResult.success) return next(tokenResult.error);
  next();
};

export const validateEmailTokenValidator = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const tokenQuery = z.uuid().safeParse(req.query?.token)
  if(!tokenQuery.success) return next(tokenQuery.error);
  next();
}
