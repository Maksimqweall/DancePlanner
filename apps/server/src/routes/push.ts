import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../lib/http";

const router = Router();
router.use(requireAuth);

// POST /api/push/register  — store this device's Expo push token for the user
router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const { token, platform } = z
      .object({ token: z.string().min(1), platform: z.string().optional() })
      .parse(req.body);

    await prisma.pushToken.upsert({
      where: { token },
      update: { userId: req.userId!, platform: platform ?? null },
      create: { token, userId: req.userId!, platform: platform ?? null },
    });
    res.json({ ok: true });
  })
);

// POST /api/push/unregister  — drop a token (e.g. on logout)
router.post(
  "/unregister",
  asyncHandler(async (req, res) => {
    const { token } = z.object({ token: z.string().min(1) }).parse(req.body);
    await prisma.pushToken.deleteMany({ where: { token } });
    res.json({ ok: true });
  })
);

export default router;
