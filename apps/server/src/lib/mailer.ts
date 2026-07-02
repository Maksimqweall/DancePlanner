import nodemailer from "nodemailer";
import { env } from "./env";

function isSmtpConfigured() {
  return Boolean(env.smtp.host && env.smtp.user && env.smtp.pass);
}

function createTransport() {
  return nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.port === 465,
    auth: { user: env.smtp.user, pass: env.smtp.pass },
  });
}

export async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  if (!isSmtpConfigured()) {
    throw new Error("Email is not configured on this server. Contact support to reset your password.");
  }

  await createTransport().sendMail({
    from: env.smtp.from || env.smtp.user,
    to,
    subject: "DancePlanner — Reset your password",
    text: [
      "Your DancePlanner password reset code:",
      "",
      `  ${token}`,
      "",
      "Enter this code in the app to set a new password.",
      "The code expires in 1 hour.",
      "",
      "If you didn't request this, ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family:sans-serif;max-width:420px;margin:auto;padding:24px">
        <h2 style="margin-bottom:8px">Reset your DancePlanner password</h2>
        <p style="color:#555">Enter the code below in the app to set a new password.</p>
        <div style="font-size:34px;font-weight:700;letter-spacing:8px;padding:20px;
                    background:#f0f0f0;border-radius:10px;text-align:center;
                    margin:24px 0;color:#111">
          ${token}
        </div>
        <p style="color:#555">This code expires in <strong>1 hour</strong>.</p>
        <p style="color:#999;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}

export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  if (!isSmtpConfigured()) {
    throw new Error("Email is not configured on this server. Contact support to verify your account.");
  }

  await createTransport().sendMail({
    from: env.smtp.from || env.smtp.user,
    to,
    subject: "Dance Planner — Verify your email",
    text: [
      "Your Dance Planner email verification code:",
      "",
      `  ${code}`,
      "",
      "Enter this code in the app to activate your account.",
      "The code expires in 1 hour.",
      "",
      "If you didn't create a Dance Planner account, ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family:sans-serif;max-width:420px;margin:auto;padding:24px">
        <h2 style="margin-bottom:8px">Verify your email</h2>
        <p style="color:#555">Enter the code below in the app to activate your Dance Planner account.</p>
        <div style="font-size:34px;font-weight:700;letter-spacing:8px;padding:20px;
                    background:#f0f0f0;border-radius:10px;text-align:center;
                    margin:24px 0;color:#111">
          ${code}
        </div>
        <p style="color:#555">This code expires in <strong>1 hour</strong>.</p>
        <p style="color:#999;font-size:13px">If you didn't create a Dance Planner account, you can safely ignore this email.</p>
      </div>
    `,
  });
}
