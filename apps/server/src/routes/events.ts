import fs from "fs";
import path from "path";
import { Router } from "express";
import { prisma } from "../prisma";
import { requireAuth } from "../middleware/auth";
import { asyncHandler, HttpError, param } from "../lib/http";
import { upload, UPLOADS_DIR } from "../lib/upload";
import { env } from "../lib/env";
import {
  createEventSchema,
  updateEventSchema,
  createChecklistItemSchema,
  updateChecklistItemSchema,
} from "../lib/validation";
import { logActivity } from "../lib/activity";

const router = Router();
router.use(requireAuth);

async function getOwnedEvent(id: string, userId: string) {
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event || event.ownerId !== userId) {
    throw new HttpError(404, "Project not found");
  }
  return event;
}

// GET /api/events  -> list of the user's projects (with light aggregates)
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const events = await prisma.event.findMany({
      where: { ownerId: req.userId },
      orderBy: { date: "asc" },
      include: {
        _count: { select: { attachments: true, checklist: true, expenses: true } },
      },
    });
    res.json({ events });
  })
);

// GET /api/events/:id  -> full project detail
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    await getOwnedEvent(param(req, "id"), req.userId!);
    const event = await prisma.event.findUnique({
      where: { id: param(req, "id") },
      include: {
        attachments: { orderBy: { createdAt: "desc" } },
        checklist: { orderBy: { createdAt: "asc" } },
        expenses: { orderBy: { date: "desc" } },
      },
    });
    res.json({ event });
  })
);

// POST /api/events
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const data = createEventSchema.parse(req.body);
    const event = await prisma.event.create({
      data: { ...data, ownerId: req.userId! },
    });
    res.status(201).json({ event });
    logActivity(req.userId!, { resource: "events", action: "added", summary: event.title });
  })
);

// PATCH /api/events/:id
router.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    await getOwnedEvent(param(req, "id"), req.userId!);
    const data = updateEventSchema.parse(req.body);
    const event = await prisma.event.update({ where: { id: param(req, "id") }, data });
    res.json({ event });
    logActivity(req.userId!, { resource: "events", action: "updated", summary: event.title });
  })
);

// DELETE /api/events/:id
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const eventId = param(req, "id");
    const ev = await getOwnedEvent(eventId, req.userId!);

    // Remove attached files from disk (best-effort, outside transaction).
    const attachments = await prisma.attachment.findMany({ where: { eventId } });
    for (const att of attachments) removeUploadedFile(att.fileUrl);

    await prisma.$transaction(async (tx) => {
      // Find all expenses linked to this event.
      const eventExpenses = await tx.expense.findMany({
        where: { eventId },
        select: { id: true },
      });
      const expenseIds = eventExpenses.map((e) => e.id);

      if (expenseIds.length > 0) {
        // Null out ScheduleEntry.expenseId before deleting (FK points expense→scheduleEntry).
        await tx.scheduleEntry.updateMany({
          where: { expenseId: { in: expenseIds } },
          data: { expenseId: null },
        });
        await tx.expense.deleteMany({ where: { id: { in: expenseIds } } });
      }

      // Attachments + checklist cascade via onDelete: Cascade in the schema.
      await tx.event.delete({ where: { id: eventId } });
    });

    res.status(204).end();
    logActivity(req.userId!, { resource: "events", action: "deleted", summary: ev.title });
  })
);

// --- Checklist ---

// POST /api/events/:id/checklist
router.post(
  "/:id/checklist",
  asyncHandler(async (req, res) => {
    const ev = await getOwnedEvent(param(req, "id"), req.userId!);
    const data = createChecklistItemSchema.parse(req.body);
    const item = await prisma.checklistItem.create({
      data: { eventId: param(req, "id"), text: data.text },
    });
    res.status(201).json({ item });
    logActivity(req.userId!, { resource: "events", action: "updated", summary: `${ev.title} · checklist: ${data.text}` });
  })
);

// PATCH /api/events/:id/checklist/:itemId
router.patch(
  "/:id/checklist/:itemId",
  asyncHandler(async (req, res) => {
    const ev = await getOwnedEvent(param(req, "id"), req.userId!);
    const data = updateChecklistItemSchema.parse(req.body);
    const existing = await prisma.checklistItem.findUnique({
      where: { id: param(req, "itemId") },
    });
    if (!existing || existing.eventId !== param(req, "id")) {
      throw new HttpError(404, "Checklist item not found");
    }
    const item = await prisma.checklistItem.update({
      where: { id: param(req, "itemId") },
      data,
    });
    res.json({ item });
    logActivity(req.userId!, {
      resource: "events", action: "updated",
      summary: `${ev.title} · ${item.text} → ${item.isDone ? "done" : "to-do"}`,
    });
  })
);

// DELETE /api/events/:id/checklist/:itemId
router.delete(
  "/:id/checklist/:itemId",
  asyncHandler(async (req, res) => {
    const ev = await getOwnedEvent(param(req, "id"), req.userId!);
    const existing = await prisma.checklistItem.findUnique({
      where: { id: param(req, "itemId") },
    });
    if (!existing || existing.eventId !== param(req, "id")) {
      throw new HttpError(404, "Checklist item not found");
    }
    await prisma.checklistItem.delete({ where: { id: param(req, "itemId") } });
    res.status(204).end();
    logActivity(req.userId!, { resource: "events", action: "updated", summary: `${ev.title} · removed checklist: ${existing.text}` });
  })
);

// --- Attachments (PDF / image upload) ---

// POST /api/events/:id/attachments  (multipart/form-data: file, label?)
router.post(
  "/:id/attachments",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const ev = await getOwnedEvent(param(req, "id"), req.userId!);
    if (!req.file) {
      throw new HttpError(400, "No file uploaded (expected field 'file')");
    }
    const label =
      typeof req.body.label === "string" && req.body.label.trim()
        ? req.body.label.trim()
        : "Attachment";

    const fileUrl = `${env.publicUrl}/uploads/${req.file.filename}`;
    const attachment = await prisma.attachment.create({
      data: {
        eventId: param(req, "id"),
        label,
        fileName: req.file.originalname,
        fileUrl,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
    });
    res.status(201).json({ attachment });
    logActivity(req.userId!, { resource: "events", action: "updated", summary: `${ev.title} · attachment: ${label}` });
  })
);

// DELETE /api/events/:id/attachments/:attId
router.delete(
  "/:id/attachments/:attId",
  asyncHandler(async (req, res) => {
    const ev = await getOwnedEvent(param(req, "id"), req.userId!);
    const att = await prisma.attachment.findUnique({ where: { id: param(req, "attId") } });
    if (!att || att.eventId !== param(req, "id")) {
      throw new HttpError(404, "Attachment not found");
    }
    removeUploadedFile(att.fileUrl);
    await prisma.attachment.delete({ where: { id: param(req, "attId") } });
    res.status(204).end();
    logActivity(req.userId!, { resource: "events", action: "updated", summary: `${ev.title} · removed attachment: ${att.label}` });
  })
);

// Best-effort delete of a previously uploaded file from disk.
function removeUploadedFile(fileUrl: string) {
  const filename = path.basename(fileUrl);
  const filePath = path.join(UPLOADS_DIR, filename);
  fs.promises.unlink(filePath).catch(() => {
    /* file already gone — ignore */
  });
}

export default router;
