import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required("JWT_SECRET"),
  publicUrl: process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 4000}`,
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  telegramChatId:   process.env.TELEGRAM_CHAT_ID ?? "",
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "http://localhost:8081,http://localhost:19006")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  smtp: {
    host:     (process.env.SMTP_HOST ?? "").trim(),
    port:     Number(process.env.SMTP_PORT ?? 587),
    user:     (process.env.SMTP_USER ?? "").trim(),
    pass:     (process.env.SMTP_PASS ?? "").trim(),
    from:     (process.env.SMTP_FROM ?? "").trim(),
  },
};
