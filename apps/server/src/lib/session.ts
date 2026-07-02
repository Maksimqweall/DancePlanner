import { prisma } from "../prisma";

// Idle-timeout windows: a session that isn't used for this long is dead. Each
// authenticated request slides expiresAt forward by the same window again.
export const SESSION_WINDOW = {
  default: 7 * 24 * 60 * 60 * 1000, // 7 days
  remember: 30 * 24 * 60 * 60 * 1000, // 30 days
};

export function sessionWindowMs(rememberMe: boolean): number {
  return rememberMe ? SESSION_WINDOW.remember : SESSION_WINDOW.default;
}

export async function createSession(userId: string, rememberMe: boolean) {
  return prisma.session.create({
    data: {
      userId,
      rememberMe,
      expiresAt: new Date(Date.now() + sessionWindowMs(rememberMe)),
    },
  });
}
