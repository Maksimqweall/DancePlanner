// Shared API types — keep in sync with apps/server Prisma schema & validation.

export type Category =
  | "INDIVIDUAL"
  | "GROUP"
  | "PRACTICE"
  | "HALL_RENT"
  | "COSTUME"
  | "FLIGHT"
  | "HOTEL"
  | "START_FEE"
  | "VISA"
  | "OTHER";

export type EventType =
  | "TOURNAMENT"
  | "CAMP"
  | "PRACTICE"
  | "INDIVIDUAL"
  | "GROUP_LESSON";

export type ExpenseStatus = "PLANNED" | "PAID";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
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
