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
});

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
  startTime: timeString.optional().nullable(),
  endTime: timeString.optional().nullable(),
  allDay: z.boolean().optional().default(false),
  location: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  eventId: z.string().uuid().optional().nullable(),
  // Optional money tie-in: creates a linked Expense.
  cost: z.number().positive().optional().nullable(),
  category: z.enum(EXPENSE_CATEGORIES).optional().nullable(),
  currency: z.string().min(1).default("EUR"),
});

export const updateScheduleSchema = createScheduleSchema.partial();
