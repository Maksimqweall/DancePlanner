import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/jwt";
import { prisma } from "../prisma";
import { sessionWindowMs } from "../lib/session";

// Augment Express's Request with the authenticated user id.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      sessionId?: string;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = header.slice("Bearer ".length).trim();
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const session = await prisma.session.findUnique({ where: { id: payload.sessionId } });
  if (!session || session.expiresAt < new Date()) {
    res.status(401).json({ error: "Your session has expired. Please log in again.", code: "SESSION_EXPIRED" });
    return;
  }

  req.userId = payload.userId;
  req.sessionId = session.id;

  // Sliding idle timeout: every authenticated request pushes the deadline
  // forward again. Fire-and-forget — must not delay or fail the request.
  prisma.session
    .update({
      where: { id: session.id },
      data: { expiresAt: new Date(Date.now() + sessionWindowMs(session.rememberMe)), lastSeenAt: new Date() },
    })
    .catch(() => {});

  next();
}
