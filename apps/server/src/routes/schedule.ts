import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler, HttpError, param, queryString } from "../lib/http";
import {
  createScheduleSchema,
  updateScheduleSchema,
} from "../lib/validation";
import { notifyPartner } from "../lib/partnerNotify";

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
  expense: { select: { id: true, amount: true, category: true, status: true, userId: true } },
} as const;

async function assertEventOwnership(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event || event.ownerId !== userId) {
    throw new HttpError(404, "Project not found");
  }
}

// GET /api/schedule?month=YYYY-MM  (defaults to the current month)
// When in a couple, returns entries for BOTH partners so the calendar is shared.
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const month = queryString(req, "month");

    // Collect the IDs of all users whose entries should appear in this calendar
    const couple = await prisma.couple.findFirst({
      where: { isActive: true, OR: [{ leadId: req.userId }, { followId: req.userId }] },
    });
    const partnerId = couple
      ? couple.leadId === req.userId ? couple.followId : couple.leadId
      : null;
    const userIds = partnerId ? [req.userId!, partnerId] : [req.userId!];

    const where: Record<string, unknown> = { userId: { in: userIds } };
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

    // Resolve partner ID for coupleEntry / paidBy
    let partnerId: string | null = null;
    if (data.coupleEntry || data.paidBy === "PARTNER") {
      const couple = await prisma.couple.findFirst({
        where: { isActive: true, OR: [{ leadId: req.userId }, { followId: req.userId }] },
      });
      if (couple) {
        partnerId = couple.leadId === req.userId ? couple.followId : couple.leadId;
      }
    }

    const expenseUserId = data.paidBy === "PARTNER" && partnerId ? partnerId : req.userId!;

    const entry = await prisma.$transaction(async (tx) => {
      let expenseId: string | null = null;
      if (data.cost && data.cost > 0) {
        const expense = await tx.expense.create({
          data: {
            userId: expenseUserId,
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

      const myEntry = await tx.scheduleEntry.create({
        data: {
          userId: req.userId!,
          eventId: data.eventId ?? null,
          expenseId,
          title: data.title,
          type: data.type,
          date: data.date,
          endDate: data.endDate ?? null,
          startTime: data.startTime ?? null,
          endTime: data.endTime ?? null,
          allDay: data.allDay,
          location: data.location ?? null,
          notes: data.notes ?? null,
        },
        include: scheduleInclude,
      });

      // Mirror the entry to partner's calendar when coupleEntry is set
      if (data.coupleEntry && partnerId) {
        await tx.scheduleEntry.create({
          data: {
            userId: partnerId,
            eventId: null,
            expenseId: null,
            title: data.title,
            type: data.type,
            date: data.date,
            endDate: data.endDate ?? null,
            startTime: data.startTime ?? null,
            endTime: data.endTime ?? null,
            allDay: data.allDay,
            location: data.location ?? null,
            notes: data.notes ?? null,
          },
        });
      }

      return myEntry;
    });

    res.status(201).json({ entry });
    // If couple entry was created, notify partner to refresh their calendar
    if (data.coupleEntry) notifyPartner(req.userId!, "schedule");
    // If partner paid, notify them to refresh expenses too
    if (data.paidBy === "PARTNER") notifyPartner(req.userId!, "expenses");
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
          endDate: "endDate" in req.body ? data.endDate ?? null : undefined,
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

// DELETE /api/schedule?date=YYYY-MM-DD  (bulk-delete all of the user's own entries for a day)
router.delete(
  "/",
  asyncHandler(async (req, res) => {
    const dateParam = queryString(req, "date");
    if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      throw new HttpError(400, "date query param required (YYYY-MM-DD)");
    }
    const startOfDay  = new Date(`${dateParam}T00:00:00.000Z`);
    const startOfNext = new Date(startOfDay.getTime() + 86_400_000);

    await prisma.$transaction(async (tx) => {
      const toDelete = await tx.scheduleEntry.findMany({
        where: {
          userId: req.userId!,
          date: { gte: startOfDay, lt: startOfNext },
        },
        select: { id: true, expenseId: true },
      });

      const ids        = toDelete.map((e) => e.id);
      const expenseIds = toDelete.map((e) => e.expenseId).filter((id): id is string => !!id);

      if (ids.length > 0) {
        await tx.scheduleEntry.deleteMany({ where: { id: { in: ids } } });
      }
      if (expenseIds.length > 0) {
        await tx.expense.deleteMany({ where: { id: { in: expenseIds } } });
      }
    });

    res.status(204).end();
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
