import "dotenv/config";
import http from "http";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { MulterError } from "multer";
import { ZodError } from "zod";
import { env } from "./lib/env";
import { HttpError } from "./lib/http";
import { UPLOADS_DIR } from "./lib/upload";
import { attachWsServer } from "./lib/wsManager";
import authRoutes from "./routes/auth";
import expenseRoutes from "./routes/expenses";
import eventRoutes from "./routes/events";
import scheduleRoutes from "./routes/schedule";
import budgetRoutes from "./routes/budgets";
import partnerRoutes from "./routes/partner";
import proposalRoutes from "./routes/proposals";
import messageRoutes from "./routes/messages";
import pushRoutes    from "./routes/push";
import contactRoutes  from "./routes/contact";
import wdsfRoutes     from "./routes/wdsf";
import manualRoutes   from "./routes/manual";

const app = express();

app.use(cors({
  origin(origin, callback) {
    // Native mobile requests have no Origin header — always allow.
    if (!origin) return callback(null, true);
    if (env.allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
}));

// General rate limit: 300 req / 15 min per IP
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
}));

// Strict rate limit on auth endpoints: 15 req / 15 min per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});

app.use(express.json());

// Serve uploaded files (PDF tickets, bookings, etc.)
app.use("/uploads", express.static(UPLOADS_DIR));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth/login",                authLimiter);
app.use("/api/auth/signup",               authLimiter);
app.use("/api/auth/forgot-password",      authLimiter);
app.use("/api/auth/reset-password",       authLimiter);
app.use("/api/auth/verify-email",         authLimiter);
app.use("/api/auth/resend-verification",  authLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/schedule", scheduleRoutes);
app.use("/api/budgets", budgetRoutes);
app.use("/api/partner", partnerRoutes);
app.use("/api/proposals", proposalRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/push",     pushRoutes);
app.use("/api/contact",  contactRoutes);
app.use("/api/wdsf",    wdsfRoutes);
app.use("/api/manual",  manualRoutes);

// 404 for unknown API routes
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Centralized error handler
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: "Validation failed", details: err.flatten() });
    return;
  }
  if (err instanceof MulterError) {
    res.status(400).json({ error: err.message });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  if (err instanceof Error && err.message === "Only PDF and image files are allowed") {
    res.status(400).json({ error: err.message });
    return;
  }
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

const server = http.createServer(app);
attachWsServer(server);

server.listen(env.port, () => {
  console.log(`DancePlanner API listening on http://localhost:${env.port}`);
});
