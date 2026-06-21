import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler, HttpError } from "../lib/http";
import { linkPartnerSchema } from "../lib/validation";

const router = Router();
router.use(requireAuth);

const PARTNER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const;

async function findActiveCouple(userId: string) {
  return prisma.couple.findFirst({
    where: {
      isActive: true,
      OR: [{ leadId: userId }, { followId: userId }],
    },
    include: {
      lead: { select: PARTNER_SELECT },
      follow: { select: PARTNER_SELECT },
    },
  });
}

function buildCoupleResponse(
  couple: NonNullable<Awaited<ReturnType<typeof findActiveCouple>>>,
  userId: string
) {
  const partner = couple.leadId === userId ? couple.follow : couple.lead;
  return { ...couple, partner };
}

// GET /api/partner
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const couple = await findActiveCouple(req.userId!);

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

    const alreadyInCouple = await findActiveCouple(req.userId!);
    if (alreadyInCouple) throw new HttpError(409, "You are already in a couple. Disconnect first.");

    const partnerInCouple = await findActiveCouple(partner.id);
    if (partnerInCouple) throw new HttpError(409, "This user is already in a couple");

    const couple = await prisma.couple.create({
      data: { leadId: req.userId!, followId: partner.id },
      include: {
        lead: { select: PARTNER_SELECT },
        follow: { select: PARTNER_SELECT },
      },
    });

    res.status(201).json({ couple: buildCoupleResponse(couple, req.userId!) });
  })
);

// DELETE /api/partner  — disconnect from partner
router.delete(
  "/",
  asyncHandler(async (req, res) => {
    const couple = await findActiveCouple(req.userId!);
    if (!couple) throw new HttpError(404, "Not in a couple");

    await prisma.couple.update({
      where: { id: couple.id },
      data: { isActive: false },
    });

    res.status(204).end();
  })
);

// GET /api/partner/split  — expense split breakdown between partners
router.get(
  "/split",
  asyncHandler(async (req, res) => {
    const couple = await findActiveCouple(req.userId!);
    if (!couple) throw new HttpError(404, "Not in a couple");

    const partnerId = couple.leadId === req.userId ? couple.followId : couple.leadId;

    const [myExpenses, partnerExpenses] = await Promise.all([
      prisma.expense.findMany({
        where: { userId: req.userId!, status: "PAID" },
        orderBy: { date: "desc" },
        include: { event: { select: { id: true, title: true } } },
      }),
      prisma.expense.findMany({
        where: { userId: partnerId, status: "PAID" },
        orderBy: { date: "desc" },
        include: { event: { select: { id: true, title: true } } },
      }),
    ]);

    const round = (n: number) => Math.round(n * 100) / 100;
    const myTotal = round(myExpenses.reduce((s, e) => s + e.amount, 0));
    const partnerTotal = round(partnerExpenses.reduce((s, e) => s + e.amount, 0));
    // positive balance = partner owes me; negative = I owe partner
    const balance = round(myTotal - partnerTotal) / 2;

    res.json({ myTotal, partnerTotal, balance, myExpenses, partnerExpenses });
  })
);

export default router;
