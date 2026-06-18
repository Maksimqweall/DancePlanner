import type { Category, EventType, SessionType } from "./types";

export const CATEGORY_META: Record<
  Category,
  { label: string; icon: string; color: string; hex: string }
> = {
  INDIVIDUAL: { label: "Individual lesson", icon: "💃", color: "bg-emerald-500", hex: "#10b981" },
  GROUP: { label: "Group lesson", icon: "👥", color: "bg-teal-500", hex: "#14b8a6" },
  PRACTICE: { label: "Practice", icon: "🔁", color: "bg-cyan-500", hex: "#06b6d4" },
  HALL_RENT: { label: "Hall rent", icon: "🏟️", color: "bg-indigo-500", hex: "#6366f1" },
  COSTUME: { label: "Costume", icon: "👗", color: "bg-pink-500", hex: "#ec4899" },
  FLIGHT: { label: "Flight", icon: "✈️", color: "bg-amber-500", hex: "#f59e0b" },
  TRANSPORT: { label: "Transport", icon: "🚆", color: "bg-orange-500", hex: "#f97316" },
  HOTEL: { label: "Hotel", icon: "🏨", color: "bg-blue-500", hex: "#3b82f6" },
  FOOD: { label: "Food", icon: "🍽️", color: "bg-lime-500", hex: "#84cc16" },
  START_FEE: { label: "Registration fee", icon: "📝", color: "bg-purple-500", hex: "#a855f7" },
  ENTRY_TICKET: { label: "Entry ticket", icon: "🎫", color: "bg-fuchsia-500", hex: "#d946ef" },
  VISA: { label: "Visa", icon: "🛂", color: "bg-rose-500", hex: "#f43f5e" },
  OTHER: { label: "Other", icon: "📦", color: "bg-gray-500", hex: "#6b7280" },
};

export const CATEGORY_ORDER: Category[] = [
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
];

export const EVENT_TYPE_META: Record<EventType, { label: string; icon: string }> = {
  TOURNAMENT: { label: "Tournament", icon: "🏆" },
  CAMP: { label: "Training camp", icon: "🏕️" },
  PRACTICE: { label: "Practice", icon: "🔁" },
  INDIVIDUAL: { label: "Individual", icon: "💃" },
  GROUP_LESSON: { label: "Group lesson", icon: "👥" },
};

export const EVENT_TYPE_ORDER: EventType[] = [
  "TOURNAMENT",
  "CAMP",
  "PRACTICE",
  "INDIVIDUAL",
  "GROUP_LESSON",
];

// Calendar session types. `dot` is the marker colour used on the month grid.
export const SESSION_META: Record<
  SessionType,
  { label: string; icon: string; color: string; dot: string; isTraining: boolean }
> = {
  INDIVIDUAL: { label: "Individual", icon: "💃", color: "bg-emerald-500", dot: "#10b981", isTraining: true },
  GROUP_LESSON: { label: "Group lesson", icon: "👥", color: "bg-teal-500", dot: "#14b8a6", isTraining: true },
  PRACTICE: { label: "Practice", icon: "🔁", color: "bg-cyan-500", dot: "#06b6d4", isTraining: true },
  COMPETITION: { label: "Competition", icon: "🏆", color: "bg-purple-500", dot: "#a855f7", isTraining: true },
  CAMP: { label: "Training camp", icon: "🏕️", color: "bg-indigo-500", dot: "#6366f1", isTraining: true },
  REST: { label: "Rest", icon: "😴", color: "bg-zinc-600", dot: "#71717a", isTraining: false },
  OTHER: { label: "Other", icon: "📌", color: "bg-gray-500", dot: "#9ca3af", isTraining: false },
};

export const SESSION_ORDER: SessionType[] = [
  "INDIVIDUAL",
  "GROUP_LESSON",
  "PRACTICE",
  "COMPETITION",
  "CAMP",
  "REST",
  "OTHER",
];

// Calendar day key "YYYY-MM-DD" from an ISO date, in UTC (dates are stored at UTC midnight).
export function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

// Month key "YYYY-MM" from an ISO date (UTC).
export function monthKeyFromIso(iso: string): string {
  return iso.slice(0, 7);
}

export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Shift a "YYYY-MM" key by a number of months.
export function shiftMonth(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLong(monthKey: string): string {
  return new Date(`${monthKey}-01T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function monthShort(monthKey: string): string {
  return new Date(`${monthKey}-01T00:00:00`).toLocaleDateString("en-US", { month: "short" });
}

const money = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
});

export function formatMoney(amount: number): string {
  return money.format(amount);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}
