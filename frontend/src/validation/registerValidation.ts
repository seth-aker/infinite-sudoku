import * as z from "zod/mini"

const passwordRegex = /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[#?!@$ %^&*-]).{8,}$/

export const passwordSchema = z.string().check(z.regex(passwordRegex, "Password must contain a minimum of 8 characters, one uppercase, one lowercase, one number, and one special character"))

export const usernameSchema = z.string().check(z.minLength(4))
