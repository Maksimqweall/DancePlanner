import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { MulterError } from "multer";
import { ZodError } from "zod";
import { env } from "./lib/env";
import { HttpError } from "./lib/http";
import { UPLOADS_DIR } from "./lib/upload";
import authRoutes from "./routes/auth";
import expenseRoutes from "./routes/expenses";
import eventRoutes from "./routes/events";

const app = express();

app.use(cors());
app.use(express.json());

// Serve uploaded files (PDF tickets, bookings, etc.)
app.use("/uploads", express.static(UPLOADS_DIR));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/events", eventRoutes);

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
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof Error && err.message === "Only PDF and image files are allowed") {
    res.status(400).json({ error: err.message });
    return;
  }
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(env.port, () => {
  console.log(`DancePlanner API listening on http://localhost:${env.port}`);
});
