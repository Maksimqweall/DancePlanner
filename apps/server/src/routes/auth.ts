import crypto from "crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { signToken } from "../lib/jwt";
import { createSession } from "../lib/session";
import { asyncHandler, HttpError } from "../lib/http";
import {
  signupSchema,
  loginSchema,
  updateMeSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationSchema,
} from "../lib/validation";
import { requireAuth } from "../middleware/auth";
import { sendPasswordResetEmail, sendVerificationEmail } from "../lib/mailer";

// 6-character uppercase hex code, e.g. "A3F9C2" — same shape as the
// password-reset code so the mobile code-entry UI can be reused as-is.
function generateCode(): string {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

async function issueSessionToken(userId: string, rememberMe: boolean): Promise<string> {
  const session = await createSession(userId, rememberMe);
  return signToken({ userId, sessionId: session.id });
}

const router = Router();

function publicUser(user: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  monthlyBudget: number | null;
  currency: string;
  privacyAcceptedAt: Date | null;
}) {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    monthlyBudget: user.monthlyBudget,
    currency: user.currency,
    privacyAccepted: user.privacyAcceptedAt != null,
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
    const verificationCode = generateCode();
    const verificationCodeExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    let user;
    try {
      user = await prisma.user.create({
        data: {
          email: data.email,
          passwordHash,
          firstName: data.firstName,
          lastName: data.lastName,
          verificationCode,
          verificationCodeExpiry,
        },
      });
    } catch (err) {
      // Two signups for the same email can both pass the findUnique check above
      // before either commits; the DB's unique constraint is the real guard, so
      // translate its violation into the same 409 instead of a raw 500.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new HttpError(409, "An account with this email already exists");
      }
      throw err;
    }

    // Best-effort — the account still exists if this fails; the user can hit
    // "resend code" from the verify screen.
    sendVerificationEmail(user.email, verificationCode).catch((err) => {
      console.error("Verification email failed:", err);
    });

    res.status(201).json({ requiresVerification: true, email: user.email });
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

    if (!user.emailVerified) {
      throw new HttpError(403, "Please verify your email first", "EMAIL_NOT_VERIFIED");
    }

    const token = await issueSessionToken(user.id, Boolean(data.rememberMe));
    res.json({ token, user: publicUser(user) });
  })
);

// POST /api/auth/verify-email — confirms the signup code and performs the actual first login
router.post(
  "/verify-email",
  asyncHandler(async (req, res) => {
    const data = verifyEmailSchema.parse(req.body);

    let user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) {
      throw new HttpError(400, "Invalid or expired code");
    }

    if (!user.emailVerified) {
      const code = data.code.trim().toUpperCase();
      if (
        !user.verificationCode ||
        user.verificationCode !== code ||
        !user.verificationCodeExpiry ||
        user.verificationCodeExpiry < new Date()
      ) {
        throw new HttpError(400, "Invalid or expired code");
      }

      user = await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true, verificationCode: null, verificationCodeExpiry: null },
      });
    }

    const token = await issueSessionToken(user.id, Boolean(data.rememberMe));
    res.json({ token, user: publicUser(user) });
  })
);

// POST /api/auth/resend-verification
router.post(
  "/resend-verification",
  asyncHandler(async (req, res) => {
    const { email } = resendVerificationSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });

    // Always 200 — don't reveal whether the email is registered or already verified.
    if (!user || user.emailVerified) {
      res.json({ ok: true });
      return;
    }

    const verificationCode = generateCode();
    const verificationCodeExpiry = new Date(Date.now() + 60 * 60 * 1000);
    await prisma.user.update({
      where: { id: user.id },
      data: { verificationCode, verificationCodeExpiry },
    });

    try {
      await sendVerificationEmail(email, verificationCode);
    } catch (err) {
      console.error("Verification email failed:", err);
      throw new HttpError(502, "Could not send the verification email right now. Please try again later.");
    }

    res.json({ ok: true });
  })
);

// POST /api/auth/logout — ends the current session server-side
router.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.sessionId) {
      await prisma.session.delete({ where: { id: req.sessionId } }).catch(() => {});
    }
    res.status(204).end();
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
    // Prisma skips `undefined` fields, so only provided keys are updated.
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { monthlyBudget: data.monthlyBudget, currency: data.currency },
    });
    res.json({ user: publicUser(user) });
  })
);

// POST /api/auth/accept-privacy — record Privacy Policy consent for this account
router.post(
  "/accept-privacy",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { privacyAcceptedAt: new Date() },
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

    try {
      await sendPasswordResetEmail(email, token);
    } catch (err) {
      // Roll back the token so a failed send doesn't leave a dangling code.
      await prisma.user.update({
        where: { id: user.id },
        data: { resetToken: null, resetTokenExpiry: null },
      });
      console.error("Password reset email failed:", err);
      throw new HttpError(502, "Could not send the reset email right now. Please try again later.");
    }

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
