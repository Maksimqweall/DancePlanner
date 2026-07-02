import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler, HttpError, param } from "../lib/http";
import { linkPartnerSchema } from "../lib/validation";
import { findCoupleForUser, MEMBER_SELECT } from "../lib/coupleMembers";
import { logActivity } from "../lib/activity";
import { notifyInvite } from "../lib/inviteNotify";

const router = Router();
router.use(requireAuth);

type CoupleWithMembers = NonNullable<Awaited<ReturnType<typeof findCoupleForUser>>>;

function roleOf(couple: CoupleWithMembers, userId: string): "lead" | "follow" | "coach" {
  if (couple.coachId === userId) return "coach";
  return couple.leadId === userId ? "lead" : "follow";
}

function memberName(couple: CoupleWithMembers, userId: string): string {
  if (couple.leadId === userId) return couple.lead.firstName;
  if (couple.followId === userId) return couple.follow.firstName;
  return "Your partner";
}

function buildCoupleResponse(couple: CoupleWithMembers, userId: string) {
  const role = roleOf(couple, userId);
  // From a partner's perspective "partner" is the other dancer; for the coach we
  // surface the lead as the primary partner so the UI always has someone to show.
  const partner =
    role === "lead" ? couple.follow :
    role === "follow" ? couple.lead :
    couple.lead;
  return { ...couple, partner, role };
}

// GET /api/partner
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const couple = await findCoupleForUser(req.userId!);

    if (!couple) {
      res.json({ couple: null, pendingCount: 0 });
      return;
    }

    const pendingCount = await prisma.proposal.count({
      where: {
        coupleId: couple.id,
        senderId: { not: req.userId },
        status: "PENDING",
      },
    });

    res.json({ couple: buildCoupleResponse(couple, req.userId!), pendingCount });
  })
);

// GET /api/partner/invites — pending sync invites I sent or received (partner + coach)
router.get(
  "/invites",
  asyncHandler(async (req, res) => {
    const [received, sent] = await Promise.all([
      prisma.syncInvite.findMany({
        where: { receiverId: req.userId, status: "PENDING" },
        include: { sender: { select: MEMBER_SELECT } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.syncInvite.findMany({
        where: { senderId: req.userId, status: "PENDING" },
        include: { receiver: { select: MEMBER_SELECT } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    res.json({ received, sent });
  })
);

// POST /api/partner/invite — invite a partner by email (they must accept)
router.post(
  "/invite",
  asyncHandler(async (req, res) => {
    const { email } = linkPartnerSchema.parse(req.body);

    const partner = await prisma.user.findUnique({ where: { email } });
    if (!partner) throw new HttpError(404, "No account found with this email");
    if (partner.id === req.userId) throw new HttpError(400, "You cannot invite yourself");

    const alreadyInCouple = await findCoupleForUser(req.userId!);
    if (alreadyInCouple) throw new HttpError(409, "You are already in a couple. Disconnect first.");
    const partnerInCouple = await findCoupleForUser(partner.id);
    if (partnerInCouple) throw new HttpError(409, "This user is already in a couple");

    const existingPending = await prisma.syncInvite.findFirst({
      where: {
        type: "PARTNER",
        status: "PENDING",
        OR: [
          { senderId: req.userId, receiverId: partner.id },
          { senderId: partner.id, receiverId: req.userId },
        ],
      },
    });
    if (existingPending) throw new HttpError(409, "There is already a pending invite between you and this person");

    const me = await prisma.user.findUnique({ where: { id: req.userId! }, select: MEMBER_SELECT });
    const invite = await prisma.syncInvite.create({
      data: { type: "PARTNER", senderId: req.userId!, receiverId: partner.id },
      include: { receiver: { select: MEMBER_SELECT } },
    });

    res.status(201).json({ invite });
    notifyInvite(partner.id, `${me?.firstName ?? "Someone"} invited you to dance together`);
  })
);

// POST /api/partner/coach-invite — invite a coach to join the couple (they must accept)
router.post(
  "/coach-invite",
  asyncHandler(async (req, res) => {
    const { email } = linkPartnerSchema.parse(req.body);

    const couple = await findCoupleForUser(req.userId!);
    if (!couple) throw new HttpError(400, "You must be in a couple to invite a coach");
    if (couple.coachId) throw new HttpError(409, "This couple already has a coach. Remove the current coach first.");

    const coach = await prisma.user.findUnique({ where: { email } });
    if (!coach) throw new HttpError(404, "No account found with this email");
    if (coach.id === couple.leadId || coach.id === couple.followId) {
      throw new HttpError(400, "This person is already a partner in the couple");
    }
    const coachBusy = await findCoupleForUser(coach.id);
    if (coachBusy) throw new HttpError(409, "This user is already part of a couple");

    const existingPending = await prisma.syncInvite.findFirst({
      where: { type: "COACH", status: "PENDING", coupleId: couple.id, receiverId: coach.id },
    });
    if (existingPending) throw new HttpError(409, "There is already a pending invite to this coach");

    const invite = await prisma.syncInvite.create({
      data: { type: "COACH", senderId: req.userId!, receiverId: coach.id, coupleId: couple.id },
      include: { receiver: { select: MEMBER_SELECT } },
    });

    res.status(201).json({ invite });
    notifyInvite(coach.id, `${memberName(couple, req.userId!)} invited you to be their coach`);
  })
);

// POST /api/partner/invites/:id/accept
router.post(
  "/invites/:id/accept",
  asyncHandler(async (req, res) => {
    const id = param(req, "id");
    const invite = await prisma.syncInvite.findUnique({
      where: { id },
      include: { sender: { select: MEMBER_SELECT }, receiver: { select: MEMBER_SELECT } },
    });
    if (!invite) throw new HttpError(404, "Invite not found");
    if (invite.receiverId !== req.userId) throw new HttpError(403, "Not your invite to accept");
    if (invite.status !== "PENDING") throw new HttpError(409, "This invite is no longer pending");

    if (invite.type === "PARTNER") {
      // Race-safe: two concurrent accepts (or an accept racing another /invite
      // flow) could otherwise both pass the checks before either commits.
      let created;
      try {
        created = await prisma.$transaction(
          async (tx) => {
            const claim = await tx.syncInvite.updateMany({
              where: { id, status: "PENDING" },
              data: { status: "ACCEPTED", respondedAt: new Date() },
            });
            if (claim.count === 0) throw new HttpError(409, "This invite is no longer pending");

            const senderBusy = await tx.couple.findFirst({
              where: { isActive: true, OR: [{ leadId: invite.senderId }, { followId: invite.senderId }, { coachId: invite.senderId }] },
            });
            if (senderBusy) throw new HttpError(409, "The sender is already in a couple");

            const receiverBusy = await tx.couple.findFirst({
              where: { isActive: true, OR: [{ leadId: invite.receiverId }, { followId: invite.receiverId }, { coachId: invite.receiverId }] },
            });
            if (receiverBusy) throw new HttpError(409, "You are already in a couple. Disconnect first.");

            return tx.couple.create({ data: { leadId: invite.senderId, followId: invite.receiverId } });
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
        );
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
          throw new HttpError(409, "Could not complete right now. Please try again.");
        }
        throw err;
      }

      const couple = await findCoupleForUser(req.userId!);
      res.status(201).json({ couple: couple ? buildCoupleResponse(couple, req.userId!) : created });
      notifyInvite(invite.senderId, `${invite.receiver.firstName} accepted your invite — you're connected!`);
      return;
    }

    // ─── COACH ──────────────────────────────────────────────────────────────
    if (!invite.coupleId) throw new HttpError(400, "Invalid coach invite");
    try {
      await prisma.$transaction(
        async (tx) => {
          const claim = await tx.syncInvite.updateMany({
            where: { id, status: "PENDING" },
            data: { status: "ACCEPTED", respondedAt: new Date() },
          });
          if (claim.count === 0) throw new HttpError(409, "This invite is no longer pending");

          const couple = await tx.couple.findUnique({ where: { id: invite.coupleId! } });
          if (!couple || !couple.isActive) throw new HttpError(404, "That couple no longer exists");
          if (couple.coachId) throw new HttpError(409, "This couple already has a coach");

          const coachBusy = await tx.couple.findFirst({
            where: { isActive: true, OR: [{ leadId: invite.receiverId }, { followId: invite.receiverId }, { coachId: invite.receiverId }] },
          });
          if (coachBusy) throw new HttpError(409, "You are already part of a couple");

          await tx.couple.update({ where: { id: couple.id }, data: { coachId: invite.receiverId } });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") {
        throw new HttpError(409, "Could not complete right now. Please try again.");
      }
      throw err;
    }

    const couple = await findCoupleForUser(req.userId!);
    res.status(201).json({ couple: couple ? buildCoupleResponse(couple, req.userId!) : null });
    notifyInvite(invite.senderId, `${invite.receiver.firstName} accepted your coach invite`);
    logActivity(invite.senderId, {
      resource: "partner",
      action: "added",
      summary: `Coach ${invite.receiver.firstName} ${invite.receiver.lastName} joined`,
    });
  })
);

// POST /api/partner/invites/:id/decline
router.post(
  "/invites/:id/decline",
  asyncHandler(async (req, res) => {
    const id = param(req, "id");
    const invite = await prisma.syncInvite.findUnique({
      where: { id },
      include: { receiver: { select: MEMBER_SELECT } },
    });
    if (!invite) throw new HttpError(404, "Invite not found");
    if (invite.receiverId !== req.userId) throw new HttpError(403, "Not your invite to decline");

    const claim = await prisma.syncInvite.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "DECLINED", respondedAt: new Date() },
    });
    if (claim.count === 0) throw new HttpError(409, "This invite is no longer pending");

    res.status(204).end();
    notifyInvite(
      invite.senderId,
      `${invite.receiver.firstName} declined your ${invite.type === "COACH" ? "coach" : "partner"} invite`
    );
  })
);

// DELETE /api/partner/invites/:id — sender cancels a pending invite
router.delete(
  "/invites/:id",
  asyncHandler(async (req, res) => {
    const id = param(req, "id");
    const invite = await prisma.syncInvite.findUnique({ where: { id } });
    if (!invite || invite.senderId !== req.userId) throw new HttpError(404, "Invite not found");

    const claim = await prisma.syncInvite.updateMany({
      where: { id, status: "PENDING" },
      data: { status: "CANCELLED", respondedAt: new Date() },
    });
    if (claim.count === 0) throw new HttpError(409, "This invite is no longer pending");

    res.status(204).end();
  })
);

// DELETE /api/partner/coach  — remove the coach
router.delete(
  "/coach",
  asyncHandler(async (req, res) => {
    const couple = await findCoupleForUser(req.userId!);
    if (!couple || !couple.coachId) throw new HttpError(404, "No coach to remove");
    if (req.userId === couple.coachId) throw new HttpError(403, "The coach cannot remove themselves; ask a partner");

    const coachName = couple.coach ? `${couple.coach.firstName} ${couple.coach.lastName}` : "Coach";
    await prisma.couple.update({ where: { id: couple.id }, data: { coachId: null } });

    res.status(204).end();
    logActivity(req.userId!, { resource: "partner", action: "deleted", summary: `Coach ${coachName} was removed` });
  })
);

// DELETE /api/partner  — disconnect the couple
router.delete(
  "/",
  asyncHandler(async (req, res) => {
    const couple = await findCoupleForUser(req.userId!);
    if (!couple) throw new HttpError(404, "Not in a couple");

    await prisma.couple.update({
      where: { id: couple.id },
      data: { isActive: false },
    });

    res.status(204).end();
  })
);

// GET /api/partner/split  — expense split breakdown between the two partners
router.get(
  "/split",
  asyncHandler(async (req, res) => {
    const couple = await findCoupleForUser(req.userId!);
    if (!couple) throw new HttpError(404, "Not in a couple");

    // From a partner's view: me vs other partner. From the coach's view: lead vs follow.
    const role = roleOf(couple, req.userId!);
    const meId = role === "follow" ? couple.followId : couple.leadId;
    const otherId = role === "follow" ? couple.leadId : couple.followId;

    const [myExpenses, partnerExpenses] = await Promise.all([
      prisma.expense.findMany({
        where: { userId: meId, status: "PAID" },
        orderBy: { date: "desc" },
        include: { event: { select: { id: true, title: true } } },
      }),
      prisma.expense.findMany({
        where: { userId: otherId, status: "PAID" },
        orderBy: { date: "desc" },
        include: { event: { select: { id: true, title: true } } },
      }),
    ]);

    const round = (n: number) => Math.round(n * 100) / 100;
    const myTotal = round(myExpenses.reduce((s, e) => s + e.amount, 0));
    const partnerTotal = round(partnerExpenses.reduce((s, e) => s + e.amount, 0));
    const balance = round(myTotal - partnerTotal) / 2;

    res.json({ myTotal, partnerTotal, balance, myExpenses, partnerExpenses });
  })
);

export default router;
