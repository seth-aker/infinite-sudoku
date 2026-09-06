import { NextFunction, Request, Response } from "express";
import * as z from "zod/v4";

const passwordRegex = /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$ %^&*-]).{8,}$/

const passwordSchema = z.string().refine((pw) => passwordRegex.test(pw), "Password must contain a minimum of 8 characters, one uppercase, one lowercase, one number, and one special character")

const tokenBodySchema = z.discriminatedUnion('grantType', [
  z.object({
    grantType: z.literal('password'),
    email: z.string().min(4),
    password: z.string().min(4)
  }),
  z.object({
    grantType: z.literal('refreshToken'),
    refreshToken: z.string().min(1)
  })
])
export const loginBodySchema = z.object({
  email: z.email(),
  password: z.string().min(8)
})

export const registerBodySchema = z.object({
  email: z.email(),
  username: z.string().min(4),
  password: passwordSchema,
  tosAcknowledged: z.boolean()
})

export const loginBodyValidator = (req: Request, _res: Response, next: NextFunction) => {
  const validationResult = loginBodySchema.safeParse(req.body)
  if(!validationResult.success) {
    throw validationResult.error
  }
  next()
}

export const registerBodyValidator = (req: Request, _res: Response, next: NextFunction) => {
  const validationResult = registerBodySchema.safeParse(req.body)
  if(!validationResult.success) {
    throw validationResult.error
  }
  next()
}

export const tokenBodyValidator = (req: Request, _res: Response, next: NextFunction) => {
  const result = tokenBodySchema.safeParse(req.body);
  if (!result.success) return next(result.error);
  req.body = result.data;
  next();
}

export const passwordResetSchema = (req: Request, _res: Response, next: NextFunction) => {
  const pwResult = passwordSchema.safeParse(req.body?.password);
  if (!pwResult.success) return next(pwResult.error);
  const tokenResult = z.uuid().safeParse(req.query?.resetToken);
  if (!tokenResult.success) return next(tokenResult.error);
  next();
}
