import process from "node:process"

if(!process.env.SESSION_SECRET) {
  throw new Error("Missing Environment Variable: SESSION_SECRET")
}

export const authConfig = {
  secret: process.env.SESSION_SECRET
}