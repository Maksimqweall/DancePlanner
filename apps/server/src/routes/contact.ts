import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../prisma";
import { env } from "../lib/env";

const router = Router();

const contactSchema = z.object({
  message: z.string().min(1).max(2000),
});

router.post("/", requireAuth, async (req, res) => {
  const { message } = contactSchema.parse(req.body);

  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { firstName: true, lastName: true, email: true },
  });

  const name  = user ? `${user.firstName} ${user.lastName}` : "Unknown user";
  const email = user?.email ?? "";

  const text = `📩 *New message from Dance Planner*\n\n👤 *${name}* (${email})\n\n${message}`;

  if (env.telegramBotToken && env.telegramChatId) {
    await fetch(`https://api.telegram.org/bot${env.telegramBotToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: env.telegramChatId,
        text,
        parse_mode: "Markdown",
      }),
    });
  }

  res.json({ ok: true });
});

export default router;
