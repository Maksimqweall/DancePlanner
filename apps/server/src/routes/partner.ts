import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler, HttpError } from "../lib/http";
import { linkPartnerSchema } from "../lib/validation";
import { findCoupleForUser, MEMBER_SELECT } from "../lib/coupleMembers";
import { logActivity } from "../lib/activity";

const router = Router();
router.use(requireAuth);

type CoupleWithMembers = NonNullable<Awaited<ReturnType<typeof findCoupleForUser>>>;

function roleOf(couple: CoupleWithMembers, userId: string): "lead" | "follow" | "coach" {
  if (couple.coachId === userId) return "coach";
  return couple.leadId === userId ? "lead" : "follow";
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

// POST /api/partner/link  — connect with a partner by email
router.post(
  "/link",
  asyncHandler(async (req, res) => {
    const { email } = linkPartnerSchema.parse(req.body);

    const partner = await prisma.user.findUnique({ where: { email } });
    if (!partner) throw new HttpError(404, "No account found with this email");
    if (partner.id === req.userId) throw new HttpError(400, "You cannot link to yourself");

    const alreadyInCouple = await findCoupleForUser(req.userId!);
    if (alreadyInCouple) throw new HttpError(409, "You are already in a couple. Disconnect first.");

    const partnerInCouple = await findCoupleForUser(partner.id);
    if (partnerInCouple) throw new HttpError(409, "This user is already in a couple");

    const created = await prisma.couple.create({
      data: { leadId: req.userId!, followId: partner.id },
    });
    const couple = await findCoupleForUser(req.userId!);

    res.status(201).json({ couple: couple ? buildCoupleResponse(couple, req.userId!) : created });
  })
);

// POST /api/partner/coach  — add a coach to the couple by email (full member)
router.post(
  "/coach",
  asyncHandler(async (req, res) => {
    const { email } = linkPartnerSchema.parse(req.body);

    const couple = await findCoupleForUser(req.userId!);
    if (!couple) throw new HttpError(400, "You must be in a couple to add a coach");
    if (couple.coachId) throw new HttpError(409, "This couple already has a coach. Remove the current coach first.");

    const coach = await prisma.user.findUnique({ where: { email } });
    if (!coach) throw new HttpError(404, "No account found with this email");
    if (coach.id === couple.leadId || coach.id === couple.followId) {
      throw new HttpError(400, "This person is already a partner in the couple");
    }
    const coachBusy = await findCoupleForUser(coach.id);
    if (coachBusy) throw new HttpError(409, "This user is already part of a couple");

    await prisma.couple.update({ where: { id: couple.id }, data: { coachId: coach.id } });
    const updated = await findCoupleForUser(req.userId!);

    res.status(201).json({ couple: updated ? buildCoupleResponse(updated, req.userId!) : null });

    logActivity(req.userId!, {
      resource: "partner",
      action: "added",
      summary: `Coach ${coach.firstName} ${coach.lastName} joined`,
    });
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
