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
  })
);

// DELETE /api/events/:id
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await getOwnedEvent(param(req, "id"), req.userId!);
    // Remove attached files from disk before deleting the project.
    const attachments = await prisma.attachment.findMany({
      where: { eventId: param(req, "id") },
    });
    for (const att of attachments) {
      removeUploadedFile(att.fileUrl);
    }
    // Detach expenses (keep them, just unlink from the deleted project).
    await prisma.expense.updateMany({
      where: { eventId: param(req, "id") },
      data: { eventId: null },
    });
    await prisma.event.delete({ where: { id: param(req, "id") } });
    res.status(204).end();
  })
);

// --- Checklist ---

// POST /api/events/:id/checklist
router.post(
  "/:id/checklist",
  asyncHandler(async (req, res) => {
    await getOwnedEvent(param(req, "id"), req.userId!);
    const data = createChecklistItemSchema.parse(req.body);
    const item = await prisma.checklistItem.create({
      data: { eventId: param(req, "id"), text: data.text },
    });
    res.status(201).json({ item });
  })
);

// PATCH /api/events/:id/checklist/:itemId
router.patch(
  "/:id/checklist/:itemId",
  asyncHandler(async (req, res) => {
    await getOwnedEvent(param(req, "id"), req.userId!);
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
  })
);

// DELETE /api/events/:id/checklist/:itemId
router.delete(
  "/:id/checklist/:itemId",
  asyncHandler(async (req, res) => {
    await getOwnedEvent(param(req, "id"), req.userId!);
    const existing = await prisma.checklistItem.findUnique({
      where: { id: param(req, "itemId") },
    });
    if (!existing || existing.eventId !== param(req, "id")) {
      throw new HttpError(404, "Checklist item not found");
    }
    await prisma.checklistItem.delete({ where: { id: param(req, "itemId") } });
    res.status(204).end();
  })
);

// --- Attachments (PDF / image upload) ---

// POST /api/events/:id/attachments  (multipart/form-data: file, label?)
router.post(
  "/:id/attachments",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    await getOwnedEvent(param(req, "id"), req.userId!);
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
  })
);

// DELETE /api/events/:id/attachments/:attId
router.delete(
  "/:id/attachments/:attId",
  asyncHandler(async (req, res) => {
    await getOwnedEvent(param(req, "id"), req.userId!);
    const att = await prisma.attachment.findUnique({ where: { id: param(req, "attId") } });
    if (!att || att.eventId !== param(req, "id")) {
      throw new HttpError(404, "Attachment not found");
    }
    removeUploadedFile(att.fileUrl);
    await prisma.attachment.delete({ where: { id: param(req, "attId") } });
    res.status(204).end();
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
