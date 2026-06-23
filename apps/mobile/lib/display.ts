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

// ─── Currency ──────────────────────────────────────────────────────────────
// Supported display currencies (several European + US Dollar). Keep the codes
// in sync with CURRENCY_CODES in apps/server/src/lib/validation.ts.
export interface CurrencyMeta {
  code: string;
  symbol: string;
  label: string;
  position: "prefix" | "suffix";
}

export const CURRENCIES: Record<string, CurrencyMeta> = {
  EUR: { code: "EUR", symbol: "€",   label: "Euro",            position: "prefix" },
  USD: { code: "USD", symbol: "$",   label: "US Dollar",       position: "prefix" },
  GBP: { code: "GBP", symbol: "£",   label: "British Pound",   position: "prefix" },
  CHF: { code: "CHF", symbol: "CHF", label: "Swiss Franc",     position: "prefix" },
  SEK: { code: "SEK", symbol: "kr",  label: "Swedish Krona",   position: "suffix" },
  NOK: { code: "NOK", symbol: "kr",  label: "Norwegian Krone", position: "suffix" },
  DKK: { code: "DKK", symbol: "kr",  label: "Danish Krone",    position: "suffix" },
  PLN: { code: "PLN", symbol: "zł",  label: "Polish Złoty",    position: "suffix" },
  CZK: { code: "CZK", symbol: "Kč",  label: "Czech Koruna",    position: "suffix" },
};

export const CURRENCY_ORDER: string[] = ["EUR", "USD", "GBP", "CHF", "SEK", "NOK", "DKK", "PLN", "CZK"];

// Module-level display currency, updated from the signed-in user's preference
// (see useAuthStore). formatMoney() reads this so all amounts re-format together.
let currentCurrency = "EUR";

export function setDisplayCurrency(code: string | null | undefined): void {
  if (code && CURRENCIES[code]) currentCurrency = code;
}

export function getDisplayCurrency(): CurrencyMeta {
  return CURRENCIES[currentCurrency] ?? CURRENCIES.EUR;
}

// Symbol of the active currency — handy for input-field labels like "Amount (€)".
export function currencySymbol(): string {
  return getDisplayCurrency().symbol;
}

const decimalFmt = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 });

export function formatMoney(amount: number): string {
  const c = getDisplayCurrency();
  const n = decimalFmt.format(amount);
  if (c.position === "suffix") return `${n} ${c.symbol}`;
  // Multi-letter prefixes (e.g. CHF) read better with a space; symbols hug the number.
  return c.symbol.length > 1 ? `${c.symbol} ${n}` : `${c.symbol}${n}`;
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
