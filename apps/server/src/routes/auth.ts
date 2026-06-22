import crypto from "crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../prisma";
import { signToken } from "../lib/jwt";
import { asyncHandler, HttpError } from "../lib/http";
import {
  signupSchema,
  loginSchema,
  updateMeSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../lib/validation";
import { requireAuth } from "../middleware/auth";
import { sendPasswordResetEmail } from "../lib/mailer";

const router = Router();

function publicUser(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  monthlyBudget: number | null;
}) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    monthlyBudget: user.monthlyBudget,
  };
}

// POST /api/auth/signup
router.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const data = signupSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw new HttpError(409, "An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
      },
    });

    const token = signToken({ userId: user.id });
    res.status(201).json({ token, user: publicUser(user) });
  })
);

// POST /api/auth/login
router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const data = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      throw new HttpError(401, "Invalid email or password");
    }

    const ok = await bcrypt.compare(data.password, user.passwordHash);
    if (!ok) {
      throw new HttpError(401, "Invalid email or password");
    }

    const token = signToken({ userId: user.id });
    res.json({ token, user: publicUser(user) });
  })
);

// GET /api/auth/me
router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      throw new HttpError(404, "User not found");
    }
    res.json({ user: publicUser(user) });
  })
);

// PATCH /api/auth/me  — update profile settings (e.g. monthly budget)
router.patch(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const data = updateMeSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { monthlyBudget: data.monthlyBudget },
    });
    res.json({ user: publicUser(user) });
  })
);

// POST /api/auth/forgot-password
router.post(
  "/forgot-password",
  asyncHandler(async (req, res) => {
    const { email } = forgotPasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });

    // Always 200 — don't reveal whether the email is registered.
    if (!user) {
      res.json({ ok: true });
      return;
    }

    // 6-character uppercase hex code, e.g. "A3F9C2"
    const token = crypto.randomBytes(3).toString("hex").toUpperCase();
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken: token, resetTokenExpiry: expiry },
    });

    await sendPasswordResetEmail(email, token);
    res.json({ ok: true });
  })
);

// POST /api/auth/reset-password
router.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    const { token, password } = resetPasswordSchema.parse(req.body);

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token.toUpperCase(),
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!user) {
      throw new HttpError(400, "Invalid or expired reset code");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetToken: null, resetTokenExpiry: null },
    });

    res.json({ ok: true });
  })
);

export default router;
