import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler, HttpError, param } from "../lib/http";
import { budgetUpsertSchema, MONTH_RE } from "../lib/validation";
import { logActivity } from "../lib/activity";

const router = Router();
router.use(requireAuth);

// GET /api/budgets -> per-month overrides for the user
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const budgets = await prisma.monthlyBudget.findMany({
      where: { userId: req.userId },
      orderBy: { month: "asc" },
      select: { month: true, amount: true },
    });
    res.json({ budgets });
  })
);

// PUT /api/budgets/:month  (YYYY-MM) -> set this month's budget
router.put(
  "/:month",
  asyncHandler(async (req, res) => {
    const month = param(req, "month");
    if (!MONTH_RE.test(month)) throw new HttpError(400, "Invalid month, expected YYYY-MM");
    const { amount } = budgetUpsertSchema.parse(req.body);

    const budget = await prisma.monthlyBudget.upsert({
      where: { userId_month: { userId: req.userId!, month } },
      update: { amount },
      create: { userId: req.userId!, month, amount },
      select: { month: true, amount: true },
    });
    res.json({ budget });
    logActivity(req.userId!, { resource: "budgets", action: "updated", summary: `${month} → ${amount}` });
  })
);

// DELETE /api/budgets/:month -> revert to the default budget
router.delete(
  "/:month",
  asyncHandler(async (req, res) => {
    const month = param(req, "month");
    await prisma.monthlyBudget.deleteMany({ where: { userId: req.userId, month } });
    res.status(204).end();
    logActivity(req.userId!, { resource: "budgets", action: "deleted", summary: `${month} budget reset` });
  })
);

export default router;
