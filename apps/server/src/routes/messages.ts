import { Router } from "express";
import { z } from "zod";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler, HttpError } from "../lib/http";
import { findCoupleIdsForUser, otherMemberIds } from "../lib/coupleMembers";
import { notify } from "../lib/wsManager";
import { sendPushToUsers } from "../lib/push";

const router = Router();
router.use(requireAuth);

const AUTHOR_SELECT = { id: true, firstName: true, lastName: true } as const;

// GET /api/messages?before=ISO&limit=N  — couple chat / activity feed (oldest→newest)
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const couple = await findCoupleIdsForUser(req.userId!);
    if (!couple) {
      res.json({ messages: [], unread: 0 });
      return;
    }

    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 100);
    const before = req.query.before ? new Date(String(req.query.before)) : undefined;

    const messages = await prisma.message.findMany({
      where: { coupleId: couple.id, ...(before ? { createdAt: { lt: before } } : {}) },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { author: { select: AUTHOR_SELECT } },
    });

    const read = await prisma.messageRead.findUnique({
      where: { coupleId_userId: { coupleId: couple.id, userId: req.userId! } },
    });
    const unread = await prisma.message.count({
      where: {
        coupleId: couple.id,
        authorId: { not: req.userId },
        ...(read ? { createdAt: { gt: read.lastReadAt } } : {}),
      },
    });

    res.json({ messages: messages.reverse(), unread });
  })
);

// POST /api/messages  — send a free-text chat message
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const { body } = z.object({ body: z.string().min(1).max(2000) }).parse(req.body);

    const couple = await findCoupleIdsForUser(req.userId!);
    if (!couple) throw new HttpError(400, "You must be in a couple to chat");

    const message = await prisma.message.create({
      data: { coupleId: couple.id, authorId: req.userId!, kind: "TEXT", body },
      include: { author: { select: AUTHOR_SELECT } },
    });

    res.status(201).json({ message });

    const recipients = otherMemberIds(couple, req.userId!);
    for (const uid of recipients) {
      notify(uid, { type: "message", coupleId: couple.id, messageId: message.id });
    }
    sendPushToUsers(recipients, {
      title: message.author ? message.author.firstName : "Dance Planner",
      body,
      data: { type: "chat", coupleId: couple.id },
    });
  })
);

// POST /api/messages/read  — mark the feed as read up to now
router.post(
  "/read",
  asyncHandler(async (req, res) => {
    const couple = await findCoupleIdsForUser(req.userId!);
    if (!couple) {
      res.json({ ok: true });
      return;
    }
    await prisma.messageRead.upsert({
      where: { coupleId_userId: { coupleId: couple.id, userId: req.userId! } },
      update: { lastReadAt: new Date() },
      create: { coupleId: couple.id, userId: req.userId!, lastReadAt: new Date() },
    });
    res.json({ ok: true });
  })
);

export default router;
