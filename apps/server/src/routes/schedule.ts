import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler, HttpError, param, queryString } from "../lib/http";
import {
  createScheduleSchema,
  updateScheduleSchema,
} from "../lib/validation";

const router = Router();
router.use(requireAuth);

type SessionType =
  | "INDIVIDUAL"
  | "GROUP_LESSON"
  | "PRACTICE"
  | "COMPETITION"
  | "CAMP"
  | "REST"
  | "OTHER";
type ExpenseCategory =
  | "INDIVIDUAL"
  | "GROUP"
  | "PRACTICE"
  | "HALL_RENT"
  | "COSTUME"
  | "FLIGHT"
  | "HOTEL"
  | "START_FEE"
  | "VISA"
  | "OTHER";

// Default expense category for a session type (used when no explicit override given).
function categoryForType(type: SessionType): ExpenseCategory {
  switch (type) {
    case "INDIVIDUAL":
      return "INDIVIDUAL";
    case "GROUP_LESSON":
      return "GROUP";
    case "PRACTICE":
      return "PRACTICE";
    case "COMPETITION":
      return "START_FEE";
    default:
      return "OTHER";
  }
}

// Past sessions are already PAID; today/future are PLANNED (drives forecasting).
function statusForDate(date: Date): "PAID" | "PLANNED" {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return date < startOfToday ? "PAID" : "PLANNED";
}

function monthRange(month: string): { gte: Date; lt: Date } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;
  const year = Number(match[1]);
  const m = Number(match[2]) - 1;
  return { gte: new Date(Date.UTC(year, m, 1)), lt: new Date(Date.UTC(year, m + 1, 1)) };
}

const scheduleInclude = {
  event: { select: { id: true, title: true, type: true } },
  expense: { select: { id: true, amount: true, category: true, status: true } },
} as const;

async function assertEventOwnership(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.ownerId !== userId) {
    throw new HttpError(404, "Project not found");
  }
}

// GET /api/schedule?month=YYYY-MM  (defaults to the current month)
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const month = queryString(req, "month");
    const where: Record<string, unknown> = { userId: req.userId };
    if (month) {
      const range = monthRange(month);
      if (!range) throw new HttpError(400, "Invalid month, expected YYYY-MM");
      where.date = range;
    }
    const entries = await prisma.scheduleEntry.findMany({
      where,
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      include: scheduleInclude,
    });
    res.json({ entries });
  })
);

// POST /api/schedule
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = createScheduleSchema.parse(req.body);
    if (data.eventId) await assertEventOwnership(data.eventId, req.userId!);

    const entry = await prisma.$transaction(async (tx) => {
      let expenseId: string | null = null;
      if (data.cost && data.cost > 0) {
        const expense = await tx.expense.create({
          data: {
            userId: req.userId!,
            eventId: data.eventId ?? null,
            title: data.title,
            category: data.category ?? categoryForType(data.type),
            amount: data.cost,
            currency: data.currency,
            date: data.date,
            status: statusForDate(data.date),
          },
        });
        expenseId = expense.id;
      }
      return tx.scheduleEntry.create({
        data: {
          userId: req.userId!,
          eventId: data.eventId ?? null,
          expenseId,
          title: data.title,
          type: data.type,
          date: data.date,
          startTime: data.startTime ?? null,
          endTime: data.endTime ?? null,
          allDay: data.allDay,
          location: data.location ?? null,
          notes: data.notes ?? null,
        },
        include: scheduleInclude,
      });
    });

    res.status(201).json({ entry });
  })
);

// PATCH /api/schedule/:id
router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = param(req, "id");
    const existing = await prisma.scheduleEntry.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.userId) {
      throw new HttpError(404, "Schedule entry not found");
    }

    const data = updateScheduleSchema.parse(req.body);
    if (data.eventId) await assertEventOwnership(data.eventId, req.userId!);

    // Merged final values (used for entry + any linked expense).
    const title = data.title ?? existing.title;
    const type = (data.type ?? existing.type) as SessionType;
    const date = data.date ?? existing.date;
    const eventId = "eventId" in req.body ? data.eventId ?? null : existing.eventId;

    const existingExpense = existing.expenseId
      ? await prisma.expense.findUnique({ where: { id: existing.expenseId } })
      : null;

    // Decide the target cost: explicit in body, else keep existing linked amount.
    const costProvided = "cost" in req.body;
    const targetCost = costProvided
      ? data.cost ?? null
      : existingExpense?.amount ?? null;
    const currency = data.currency ?? existingExpense?.currency ?? "EUR";
    const category =
      data.category ?? (existingExpense?.category as ExpenseCategory) ?? categoryForType(type);

    const entry = await prisma.$transaction(async (tx) => {
      let expenseId = existing.expenseId;

      if (targetCost && targetCost > 0) {
        const expenseData = {
          userId: req.userId!,
          eventId,
          title,
          category,
          amount: targetCost,
          currency,
          date,
          status: statusForDate(date),
        };
        if (existingExpense) {
          await tx.expense.update({ where: { id: existingExpense.id }, data: expenseData });
        } else {
          const created = await tx.expense.create({ data: expenseData });
          expenseId = created.id;
        }
      } else if (existingExpense) {
        // Cost cleared — detach and remove the auto-created expense.
        expenseId = null;
        await tx.scheduleEntry.update({ where: { id }, data: { expenseId: null } });
        await tx.expense.delete({ where: { id: existingExpense.id } });
      }

      return tx.scheduleEntry.update({
        where: { id },
        data: {
          expenseId,
          title: data.title ?? undefined,
          type: data.type ?? undefined,
          date: data.date ?? undefined,
          startTime: "startTime" in req.body ? data.startTime ?? null : undefined,
          endTime: "endTime" in req.body ? data.endTime ?? null : undefined,
          allDay: data.allDay ?? undefined,
          location: "location" in req.body ? data.location ?? null : undefined,
          notes: "notes" in req.body ? data.notes ?? null : undefined,
          eventId: "eventId" in req.body ? eventId : undefined,
        },
        include: scheduleInclude,
      });
    });

    res.json({ entry });
  })
);

// DELETE /api/schedule/:id  (also removes the auto-created expense, if any)
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = param(req, "id");
    const existing = await prisma.scheduleEntry.findUnique({ where: { id } });
    if (!existing || existing.userId !== req.userId) {
      throw new HttpError(404, "Schedule entry not found");
    }
    await prisma.$transaction(async (tx) => {
      await tx.scheduleEntry.delete({ where: { id } });
      if (existing.expenseId) {
        await tx.expense.delete({ where: { id: existing.expenseId } });
      }
    });
    res.status(204).end();
  })
);

export default router;
