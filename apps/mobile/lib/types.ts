// Shared API types — keep in sync with apps/server Prisma schema & validation.

export type Category =
  | "INDIVIDUAL"
  | "GROUP"
  | "PRACTICE"
  | "HALL_RENT"
  | "COSTUME"
  | "FLIGHT"
  | "TRANSPORT"
  | "HOTEL"
  | "FOOD"
  | "START_FEE"
  | "ENTRY_TICKET"
  | "VISA"
  | "OTHER";

export type EventType =
  | "TOURNAMENT"
  | "CAMP"
  | "PRACTICE"
  | "INDIVIDUAL"
  | "GROUP_LESSON";

export type ExpenseStatus = "PLANNED" | "PAID";

export type SessionType =
  | "INDIVIDUAL"
  | "GROUP_LESSON"
  | "PRACTICE"
  | "COMPETITION"
  | "CAMP"
  | "REST"
  | "OTHER";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  monthlyBudget: number | null;
}

export interface Expense {
  id: string;
  userId: string;
  eventId: string | null;
  title: string | null;
  category: Category;
  amount: number;
  currency: string;
  date: string; // ISO
  description: string | null;
  status: ExpenseStatus;
  createdAt: string;
  event?: { id: string; title: string; type: EventType } | null;
}

export interface Attachment {
  id: string;
  eventId: string;
  label: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface ChecklistItem {
  id: string;
  eventId: string;
  text: string;
  isDone: boolean;
  createdAt: string;
}

export interface Project {
  id: string;
  ownerId: string | null;
  coupleId: string | null;
  title: string;
  type: EventType;
  date: string;
  endDate: string | null;
  location: string | null;
  budget: number | null;
  hotelName: string | null;
  hotelAddress: string | null;
  checkIn: string | null;
  checkOut: string | null;
  createdAt: string;
  _count?: { attachments: number; checklist: number; expenses: number };
  attachments?: Attachment[];
  checklist?: ChecklistItem[];
  expenses?: Expense[];
}

export interface Summary {
  month: string;
  total: number;
  count: number;
  byCategory: Partial<Record<Category, number>>;
}

export interface ForecastMonth {
  month: string;
  label: string;
  expected: number;
  projects: { id: string; title: string; type: EventType }[];
}

// ─── Partner Sync (Module 3) ───────────────────────────────────────────────

export type ProposalType = "TRAINING" | "TOURNAMENT" | "HOTEL" | "TRANSPORT" | "OTHER";
export type ProposalStatus = "PENDING" | "APPROVED" | "DECLINED";

export interface ProposalSender {
  id: string;
  firstName: string;
  lastName: string;
}

export interface ProposalDetails {
  date?: string;
  startTime?: string;
  notes?: string;
  location?: string;
  trainerName?: string;
  hotelName?: string;
  expenseId?: string;
  entryId?: string;
}

export interface Proposal {
  id: string;
  coupleId: string;
  senderId: string;
  title: string;
  type: ProposalType;
  status: ProposalStatus;
  cost: number | null;
  currency: string;
  details: ProposalDetails | null;
  createdAt: string;
  updatedAt: string;
  sender?: ProposalSender;
}

export interface CouplePartner {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface Couple {
  id: string;
  leadId: string;
  followId: string;
  isActive: boolean;
  createdAt: string;
  partner: CouplePartner;
}

export interface SplitView {
  myTotal: number;
  partnerTotal: number;
  balance: number;
  myExpenses: Expense[];
  partnerExpenses: Expense[];
}

// ─── Calendar Entries ──────────────────────────────────────────────────────

export interface ScheduleEntry {
  id: string;
  userId: string;
  eventId: string | null;
  expenseId: string | null;
  title: string;
  type: SessionType;
  date: string; // ISO (UTC midnight of the calendar day / start day)
  endDate: string | null; // ISO, for multi-day events (inclusive)
  startTime: string | null; // "HH:MM"
  endTime: string | null;
  allDay: boolean;
  location: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  event?: { id: string; title: string; type: EventType } | null;
  expense?: { id: string; amount: number; category: Category; status: ExpenseStatus; userId: string } | null;
}
