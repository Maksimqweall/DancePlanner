import jwt from "jsonwebtoken";
import { env } from "./env";

export interface TokenPayload {
  userId: string;
  sessionId: string;
}

// Safety-net upper bound only — actual session length (7d / 30d with "remember
// me") is enforced by the Session row looked up in requireAuth, which slides
// expiresAt forward on activity. This just caps how long a token could work if
// the Session table were ever bypassed.
const EXPIRES_IN = "90d";

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: EXPIRES_IN });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, env.jwtSecret) as TokenPayload;
}
