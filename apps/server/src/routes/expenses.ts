import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler, HttpError, param, queryString } from "../lib/http";
import {
  createExpenseSchema,
  updateExpenseSchema,
  EXPENSE_CATEGORIES,
} from "../lib/validation";
import { notifyPartner } from "../lib/partnerNotify";

const router = Router();
router.use(requireAuth);

const round2 = (n: number) => Math.round(n * 100) / 100;

type SessionType = "INDIVIDUAL" | "GROUP_LESSON" | "PRACTICE" | "COMPETITION" | "CAMP" | "REST" | "OTHER";

function categoryToSessionType(category: string): SessionType {
  switch (category) {
    case "INDIVIDUAL": return "INDIVIDUAL";
    case "GROUP": return "GROUP_LESSON";
    case "PRACTICE":
    case "HALL_RENT": return "PRACTICE";
    case "START_FEE":
    case "ENTRY_TICKET": return "COMPETITION";
    default: return "OTHER";
  }
}

// Parse a "YYYY-MM" string into [start, endExclusive) of that month.
function monthRange(month: string): { gte: Date; lt: Date } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;
  const year = Number(match[1]);
  const m = Number(match[2]) - 1;
  return { gte: new Date(year, m, 1), lt: new Date(year, m + 1, 1) };
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date: Date): string {
  return date.toLocaleString("en-US", { month: "long", year: "numeric" });
}

// GET /api/expenses?month=YYYY-MM&category=&eventId=&status=
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const where: Record<string, unknown> = { userId: req.userId };

    const month = queryString(req, "month");
    if (month) {
      const range = monthRange(month);
      if (!range) throw new HttpError(400, "Invalid month, expected YYYY-MM");
      where.date = range;
    }

    const category = queryString(req, "category");
    if (category) {
      if (!EXPENSE_CATEGORIES.includes(category as never)) {
        throw new HttpError(400, "Invalid category");
      }
      where.category = category;
    }

    const eventId = queryString(req, "eventId");
    if (eventId) where.eventId = eventId;
    const status = queryString(req, "status");
    if (status) where.status = status;

    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { date: "desc" },
      include: { event: { select: { id: true, title: true, type: true } } },
    });
    res.json({ expenses });
  })
);

// GET /api/expenses/summary?month=YYYY-MM  -> total + per-category breakdown
router.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const where: Record<string, unknown> = { userId: req.userId, status: "PAID" };

    const month = queryString(req, "month") ?? monthKey(new Date());
    const range = monthRange(month);
    if (!range) throw new HttpError(400, "Invalid month, expected YYYY-MM");
    where.date = range;

    const expenses = await prisma.expense.findMany({ where });

    const byCategory: Record<string, number> = {};
    let total = 0;
    for (const e of expenses) {
      byCategory[e.category] = round2((byCategory[e.category] ?? 0) + e.amount);
      total += e.amount;
    }

    res.json({
      month,
      total: round2(total),
      count: expenses.length,
      byCategory,
    });
  })
);

// GET /api/expenses/forecast -> expected spend per upcoming month
router.get(
  "/forecast",
  asyncHandler(async (req, res) => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Upcoming projects (events) owned by the user, with their planned expenses.
    const events = await prisma.event.findMany({
      where: { ownerId: req.userId, date: { gte: startOfMonth } },
      orderBy: { date: "asc" },
      include: { expenses: { where: { status: "PLANNED" } } },
    });

    // Planned expenses not tied to any project.
    const looseExpenses = await prisma.expense.findMany({
      where: {
        userId: req.userId,
        status: "PLANNED",
        eventId: null,
        date: { gte: startOfMonth },
      },
    });

    type Bucket = {
      month: string;
      label: string;
      sortDate: Date;
      expected: number;
      projects: { id: string; title: string; type: string }[];
    };
    const buckets = new Map<string, Bucket>();

    const bucketFor = (date: Date): Bucket => {
      const key = monthKey(date);
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = {
          month: key,
          label: monthLabel(date),
          sortDate: new Date(date.getFullYear(), date.getMonth(), 1),
          expected: 0,
          projects: [],
        };
        buckets.set(key, bucket);
      }
      return bucket;
    };

    for (const event of events) {
      const bucket = bucketFor(event.date);
      // An event's expected cost = its explicit budget, else the sum of its planned expenses.
      const plannedSum = event.expenses.reduce((s, e) => s + e.amount, 0);
      const expected = event.budget ?? plannedSum;
      bucket.expected += expected;
      bucket.projects.push({ id: event.id, title: event.title, type: event.type });
    }

    for (const expense of looseExpenses) {
      bucketFor(expense.date).expected += expense.amount;
    }

    const forecast = Array.from(buckets.values())
      .sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime())
      .map(({ sortDate: _sortDate, ...rest }) => ({ ...rest, expected: round2(rest.expected) }));

    res.json({ forecast });
  })
);

// POST /api/expenses
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = createExpenseSchema.parse(req.body);

    if (data.eventId) {
      await assertEventOwnership(data.eventId, req.userId!);
    }

    // If partner paid, create the expense under their userId
    let targetUserId = req.userId!;
    if (data.paidBy === "PARTNER") {
      const couple = await prisma.couple.findFirst({
        where: { isActive: true, OR: [{ leadId: req.userId }, { followId: req.userId }] },
      });
      if (!couple) throw new HttpError(400, "Not in a couple");
      targetUserId = couple.leadId === req.userId ? couple.followId : couple.leadId;
    }

    const expense = await prisma.expense.create({
      data: {
        userId: targetUserId,
        title: data.title ?? null,
        category: data.category,
        amount: data.amount,
        currency: data.currency,
        date: data.date,
        description: data.description ?? null,
        status: data.status,
        eventId: data.eventId ?? null,
      },
    });

    // Auto-create a calendar entry for the requester when syncCalendar is set
    if (data.syncCalendar) {
      await prisma.scheduleEntry.create({
        data: {
          userId: req.userId!,
          expenseId: expense.id,
          title: expense.title ?? data.category,
          type: categoryToSessionType(data.category),
          date: data.date,
          allDay: true,
          eventId: data.eventId ?? null,
        },
      });
    }

    res.status(201).json({ expense });
    // Notify partner so their Finance / split view refreshes automatically
    notifyPartner(req.userId!, "expenses");
  })
);

// PATCH /api/expenses/:id
router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const data = updateExpenseSchema.parse(req.body);
    await assertExpenseOwnership(param(req, "id"), req.userId!);

    if (data.eventId) {
      await assertEventOwnership(data.eventId, req.userId!);
    }

    const expense = await prisma.expense.update({
      where: { id: param(req, "id") },
      data,
    });
    res.json({ expense });
  })
);

// DELETE /api/expenses/:id
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await assertExpenseOwnership(param(req, "id"), req.userId!);
    await prisma.expense.delete({ where: { id: param(req, "id") } });
    res.status(204).end();
    notifyPartner(req.userId!, "expenses");
  })
);

async function assertExpenseOwnership(id: string, userId: string) {
  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense || expense.userId !== userId) {
    throw new HttpError(404, "Expense not found");
  }
}

async function assertEventOwnership(id: string, userId: string) {
  const event = await prisma.event.findUnique({
    where: { id },
    include: { couple: { select: { leadId: true, followId: true } } },
  });
  if (!event) throw new HttpError(404, "Project not found");

  const isOwner = event.ownerId === userId;
  const isMember = event.couple
    ? event.couple.leadId === userId || event.couple.followId === userId
    : false;

  if (!isOwner && !isMember) throw new HttpError(404, "Project not found");
}

export default router;
