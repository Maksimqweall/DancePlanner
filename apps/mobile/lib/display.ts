import type { Category, EventType } from "./types";

export const CATEGORY_META: Record<
  Category,
  { label: string; icon: string; color: string }
> = {
  INDIVIDUAL: { label: "Individual lesson", icon: "💃", color: "bg-emerald-500" },
  GROUP: { label: "Group lesson", icon: "👥", color: "bg-teal-500" },
  PRACTICE: { label: "Practice", icon: "🔁", color: "bg-cyan-500" },
  HALL_RENT: { label: "Hall rent", icon: "🏟️", color: "bg-indigo-500" },
  COSTUME: { label: "Costume", icon: "👗", color: "bg-pink-500" },
  FLIGHT: { label: "Flight", icon: "✈️", color: "bg-amber-500" },
  HOTEL: { label: "Hotel", icon: "🏨", color: "bg-blue-500" },
  START_FEE: { label: "Start fee", icon: "🎫", color: "bg-purple-500" },
  VISA: { label: "Visa", icon: "🛂", color: "bg-rose-500" },
  OTHER: { label: "Other", icon: "📦", color: "bg-gray-500" },
};

export const CATEGORY_ORDER: Category[] = [
  "INDIVIDUAL",
  "GROUP",
  "PRACTICE",
  "HALL_RENT",
  "COSTUME",
  "FLIGHT",
  "HOTEL",
  "START_FEE",
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
