import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler, HttpError, param, queryString } from "../lib/http";
import { createProposalSchema, respondProposalSchema } from "../lib/validation";
import type { ExpenseCategory, SessionType } from "@prisma/client";
import { notify } from "../lib/wsManager";
import { findCoupleIdsForUser, otherMemberIds } from "../lib/coupleMembers";
import { sendPushToUsers } from "../lib/push";
import { logActivity } from "../lib/activity";

const router = Router();
router.use(requireAuth);

// Couple including the coach as a full member.
async function findActiveCouple(userId: string) {
  return findCoupleIdsForUser(userId);
}

function proposalTypeToExpenseCategory(type: string): ExpenseCategory {
  switch (type) {
    case "TRAINING": return "INDIVIDUAL";
    case "HOTEL": return "HOTEL";
    case "TRANSPORT": return "TRANSPORT";
    case "TOURNAMENT": return "START_FEE";
    default: return "OTHER";
  }
}

function proposalTypeToSessionType(type: string): SessionType | null {
  switch (type) {
    case "TRAINING": return "INDIVIDUAL";
    case "TOURNAMENT": return "COMPETITION";
    default: return null;
  }
}

const SENDER_SELECT = { id: true, firstName: true, lastName: true } as const;

// GET /api/proposals?direction=inbox|sent|all
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const couple = await findActiveCouple(req.userId!);
    if (!couple) {
      res.json({ proposals: [] });
      return;
    }

    const direction = queryString(req, "direction") ?? "all";

    const where: Record<string, unknown> = { coupleId: couple.id };
    if (direction === "inbox") where.senderId = { not: req.userId };
    if (direction === "sent") where.senderId = req.userId;

    const proposals = await prisma.proposal.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: { sender: { select: SENDER_SELECT } },
    });

    res.json({ proposals });
  })
);

// POST /api/proposals
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const couple = await findActiveCouple(req.userId!);
    if (!couple) throw new HttpError(400, "You must be in a couple to send proposals");

    const data = createProposalSchema.parse(req.body);

    const proposal = await prisma.proposal.create({
      data: {
        coupleId: couple.id,
        senderId: req.userId!,
        title: data.title,
        type: data.type,
        cost: data.cost ?? null,
        currency: data.currency,
        details: data.details ? (data.details as object) : undefined,
      },
      include: { sender: { select: SENDER_SELECT } },
    });

    // Post the proposal into the couple chat feed so it shows up for everyone.
    const costStr = proposal.cost ? ` — ${proposal.cost} ${proposal.currency}` : "";
    const message = await prisma.message.create({
      data: {
        coupleId: couple.id,
        authorId: req.userId!,
        kind: "PROPOSAL",
        body: `Proposal: ${proposal.title}${costStr}`,
        proposalId: proposal.id,
        meta: { type: proposal.type, cost: proposal.cost, currency: proposal.currency } as object,
      },
    });

    res.status(201).json({ proposal });

    const recipients = otherMemberIds(couple, req.userId!);
    for (const uid of recipients) {
      notify(uid, { type: "message", coupleId: couple.id, messageId: message.id });
      notify(uid, { type: "sync", resource: "proposals" });
    }
    sendPushToUsers(recipients, {
      title: `${proposal.sender.firstName} sent a proposal`,
      body: `${proposal.title}${costStr}`,
      data: { type: "chat", coupleId: couple.id },
    });
  })
);

// PATCH /api/proposals/:id/respond
router.patch(
  "/:id/respond",
  asyncHandler(async (req, res) => {
    const { action } = respondProposalSchema.parse(req.body);
    const proposalId = param(req, "id");

    const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });
    if (!proposal) throw new HttpError(404, "Proposal not found");

    const couple = await findActiveCouple(req.userId!);
    if (!couple || couple.id !== proposal.coupleId) {
      throw new HttpError(403, "Not in this couple");
    }
    if (proposal.senderId === req.userId) {
      throw new HttpError(403, "Cannot respond to your own proposal");
    }
    if (proposal.status !== "PENDING") {
      throw new HttpError(409, "This proposal has already been responded to");
    }

    // Atomically claim the PENDING → (DECLINED|APPROVED) transition. Two concurrent
    // responders (e.g. partner + coach both tapping Accept at once) would otherwise
    // both pass the status check above before either write commits, and both go on
    // to create the approval side effects (expense + schedule entries) below. This
    // conditional update lets Postgres's row lock decide a single winner: only the
    // request that actually flips PENDING → x affects a row; the rest get count=0
    // and a clean 409, instead of every racer creating duplicate side effects.
    const claimedStatus = action === "DECLINE" ? "DECLINED" : "APPROVED";
    const claim = await prisma.proposal.updateMany({
      where: { id: proposalId, status: "PENDING" },
      data: { status: claimedStatus },
    });
    if (claim.count === 0) {
      throw new HttpError(409, "This proposal has already been responded to");
    }

    if (action === "DECLINE") {
      const updated = await prisma.proposal.findUniqueOrThrow({
        where: { id: proposalId },
        include: { sender: { select: SENDER_SELECT } },
      });
      res.json({ proposal: updated });
      // Notify sender their proposal was declined + feed entry + push to all members
      notify(proposal.senderId, { type: "sync", resource: "proposals" });
      logActivity(req.userId!, { resource: "proposals", action: "declined", summary: proposal.title });
      return;
    }

    // ─── APPROVE ──────────────────────────────────────────────────────────────
    const details = (proposal.details as Record<string, unknown>) ?? {};
    const createdIds: Record<string, string> = {};

    // Create a PLANNED expense for the SENDER (they proposed → they'll book it)
    if (proposal.cost && proposal.cost > 0) {
      const category = proposalTypeToExpenseCategory(proposal.type);
      const expenseDate = details.date
        ? new Date(details.date as string)
        : new Date();

      const expense = await prisma.expense.create({
        data: {
          userId: proposal.senderId,
          title: proposal.title,
          category,
          amount: proposal.cost,
          currency: proposal.currency,
          date: expenseDate,
          status: "PLANNED",
        },
      });
      createdIds.expenseId = expense.id;
    }

    // Create a ScheduleEntry for BOTH users if type maps to a session
    const sessionType = proposalTypeToSessionType(proposal.type);
    if (sessionType && details.date) {
      const sessionDate = new Date(details.date as string);

      const commonEntry = {
        title: proposal.title,
        type: sessionType,
        date: sessionDate,
        startTime: (details.startTime as string | undefined) ?? null,
        location: (details.location as string | undefined) ?? null,
        notes: (details.notes as string | undefined) ?? null,
      };

      // Create for sender
      await prisma.scheduleEntry.create({ data: { userId: proposal.senderId, ...commonEntry } });
      // Create for approver
      const approverEntry = await prisma.scheduleEntry.create({
        data: { userId: req.userId!, ...commonEntry },
      });
      createdIds.entryId = approverEntry.id;
    }

    const updated = await prisma.proposal.update({
      where: { id: proposalId },
      data: {
        details: { ...details, ...createdIds } as object,
      },
      include: { sender: { select: SENDER_SELECT } },
    });

    res.json({ proposal: updated });
    // Notify sender: their proposal was approved, new expense + schedule entries created
    notify(proposal.senderId, { type: "sync", resource: "proposals" });
    notify(proposal.senderId, { type: "sync", resource: "expenses" });
    if (sessionType && details.date) {
      notify(proposal.senderId, { type: "sync", resource: "schedule" });
    }
    logActivity(req.userId!, { resource: "proposals", action: "approved", summary: proposal.title });
  })
);

// DELETE /api/proposals/:id  — cancel a PENDING proposal (sender only)
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const proposalId = param(req, "id");
    const proposal = await prisma.proposal.findUnique({ where: { id: proposalId } });

    if (!proposal || proposal.senderId !== req.userId) {
      throw new HttpError(404, "Proposal not found");
    }
    if (proposal.status !== "PENDING") {
      throw new HttpError(409, "Cannot cancel a proposal that has already been responded to");
    }

    await prisma.proposal.delete({ where: { id: proposalId } });
    res.status(204).end();
    // Feed entry + notify all members the proposal was cancelled
    logActivity(req.userId!, { resource: "proposals", action: "deleted", summary: proposal.title });
  })
);

export default router;
