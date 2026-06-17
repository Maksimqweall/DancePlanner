import jwt from "jsonwebtoken";
import { env } from "./env";

export interface TokenPayload {
  userId: string;
}

const EXPIRES_IN = "30d";

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtSecret) as TokenPayload;
}
