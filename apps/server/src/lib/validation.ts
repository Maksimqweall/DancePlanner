import { z } from "zod";

// Keep these in sync with the Prisma enums in prisma/schema.prisma.
export const EXPENSE_CATEGORIES = [
  "INDIVIDUAL",
  "GROUP",
  "PRACTICE",
  "HALL_RENT",
  "COSTUME",
  "FLIGHT",
  "TRANSPORT",
  "HOTEL",
  "FOOD",
  "START_FEE",
  "ENTRY_TICKET",
  "VISA",
  "OTHER",
] as const;

export const EVENT_TYPES = [
  "TOURNAMENT",
  "CAMP",
  "PRACTICE",
  "INDIVIDUAL",
  "GROUP_LESSON",
] as const;

export const EXPENSE_STATUSES = ["PLANNED", "PAID"] as const;

export const SESSION_TYPES = [
  "INDIVIDUAL",
  "GROUP_LESSON",
  "PRACTICE",
  "COMPETITION",
  "CAMP",
  "REST",
  "OTHER",
] as const;

const timeString = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:MM");

// --- Auth ---
export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

export const verifyEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

export const resendVerificationSchema = z.object({
  email: z.string().email(),
});

// Supported display currencies (several European + US Dollar). Keep in sync with
// CURRENCIES in apps/mobile/lib/display.ts.
export const CURRENCY_CODES = [
  "EUR", "USD", "GBP", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK",
] as const;

export const updateMeSchema = z.object({
  monthlyBudget: z.number().positive().nullable().optional(),
  currency: z.enum(CURRENCY_CODES).optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6),
});

export const budgetUpsertSchema = z.object({
  amount: z.number().positive(),
});

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

// --- Expenses ---
export const createExpenseSchema = z.object({
  title: z.string().min(1).optional(),
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.number().positive(),
  currency: z.string().min(1).default("EUR"),
  date: z.coerce.date(),
  description: z.string().optional(),
  status: z.enum(EXPENSE_STATUSES).default("PAID"),
  eventId: z.string().uuid().optional().nullable(),
  paidBy: z.enum(["ME", "PARTNER"]).optional(),
  syncCalendar: z.boolean().optional().default(false),
});

export const updateExpenseSchema = createExpenseSchema.partial();

// --- Events / Projects ---
export const createEventSchema = z.object({
  title: z.string().min(1),
  type: z.enum(EVENT_TYPES),
  date: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
  location: z.string().optional().nullable(),
  budget: z.number().positive().optional().nullable(),
  hotelName: z.string().optional().nullable(),
  hotelAddress: z.string().optional().nullable(),
  checkIn: z.coerce.date().optional().nullable(),
  checkOut: z.coerce.date().optional().nullable(),
});

export const updateEventSchema = createEventSchema.partial();

// --- Checklist ---
export const createChecklistItemSchema = z.object({
  text: z.string().min(1),
});

export const updateChecklistItemSchema = z.object({
  text: z.string().min(1).optional(),
  isDone: z.boolean().optional(),
});

// --- Attachments ---
export const createAttachmentSchema = z.object({
  label: z.string().min(1).default("Attachment"),
});

// --- Schedule (Module 2: Smart Calendar) ---
export const createScheduleSchema = z.object({
  title: z.string().min(1),
  type: z.enum(SESSION_TYPES),
  date: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
  startTime: timeString.optional().nullable(),
  endTime: timeString.optional().nullable(),
  allDay: z.boolean().optional().default(false),
  location: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  eventId: z.string().uuid().optional().nullable(),
  cost: z.number().positive().optional().nullable(),
  category: z.enum(EXPENSE_CATEGORIES).optional().nullable(),
  currency: z.string().min(1).default("EUR"),
  coupleEntry: z.boolean().optional().default(false),
  paidBy: z.enum(["ME", "PARTNER"]).optional(),
});

export const updateScheduleSchema = createScheduleSchema.partial();

// --- Partner Sync (Module 3) ---
export const PROPOSAL_TYPES = [
  "TRAINING",
  "TOURNAMENT",
  "HOTEL",
  "TRANSPORT",
  "OTHER",
] as const;

export const linkPartnerSchema = z.object({
  email: z.string().email(),
});

export const createProposalSchema = z.object({
  title: z.string().min(1),
  type: z.enum(PROPOSAL_TYPES),
  cost: z.number().positive().optional().nullable(),
  currency: z.string().min(1).default("EUR"),
  details: z
    .object({
      date: z.string().optional(),
      startTime: timeString.optional(),
      notes: z.string().optional(),
      location: z.string().optional(),
      trainerName: z.string().optional(),
      hotelName: z.string().optional(),
    })
    .optional(),
});

export const respondProposalSchema = z.object({
  action: z.enum(["APPROVE", "DECLINE"]),
});
