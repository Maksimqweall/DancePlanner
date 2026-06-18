import { create } from "zustand";
import { api } from "../lib/api";
import type { Category, Expense, ExpenseStatus, ForecastMonth } from "../lib/types";
import { monthKeyFromIso } from "../lib/display";

export interface CreateExpenseInput {
  title?: string;
  category: Category;
  amount: number;
  date: string; // ISO
  description?: string;
  status: ExpenseStatus;
  eventId?: string | null;
}

export interface MonthAggregate {
  month: string; // YYYY-MM
  paid: number;
  planned: number;
}

interface FinanceState {
  expenses: Expense[];
  forecast: ForecastMonth[];
  budgets: Record<string, number>; // month (YYYY-MM) -> per-month budget override
  loading: boolean;

  refresh: () => Promise<void>;
  addExpense: (input: CreateExpenseInput) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  setBudget: (month: string, amount: number) => Promise<void>;
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  expenses: [],
  forecast: [],
  budgets: {},
  loading: false,

  refresh: async () => {
    set({ loading: true });
    try {
      const [expensesRes, forecastRes, budgetsRes] = await Promise.all([
        api.get<{ expenses: Expense[] }>("/expenses"),
        api.get<{ forecast: ForecastMonth[] }>("/expenses/forecast"),
        api.get<{ budgets: { month: string; amount: number }[] }>("/budgets"),
      ]);
      const budgets: Record<string, number> = {};
      for (const b of budgetsRes.budgets) budgets[b.month] = b.amount;
      set({ expenses: expensesRes.expenses, forecast: forecastRes.forecast, budgets });
    } finally {
      set({ loading: false });
    }
  },

  setBudget: async (month, amount) => {
    await api.put(`/budgets/${month}`, { amount });
    set((state) => ({ budgets: { ...state.budgets, [month]: amount } }));
  },

  addExpense: async (input) => {
    await api.post("/expenses", input);
    await get().refresh();
  },

  deleteExpense: async (id) => {
    set((state) => ({ expenses: state.expenses.filter((e) => e.id !== id) }));
    await api.del(`/expenses/${id}`);
    await get().refresh();
  },
}));

// --- Derived helpers (computed from the full expense list) ---

// Totals (paid/planned) for a single month, with a per-category breakdown of paid spend.
export function summarizeMonth(expenses: Expense[], month: string) {
  let paid = 0;
  let planned = 0;
  const byCategory: Partial<Record<Category, number>> = {};
  for (const e of expenses) {
    if (monthKeyFromIso(e.date) !== month) continue;
    if (e.status === "PAID") {
      paid += e.amount;
      byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
    } else {
      planned += e.amount;
    }
  }
  return { paid, planned, byCategory };
}

// A continuous series of month aggregates covering all months that have data
// (plus the current month), padded with zeros so the chart has no gaps.
export function monthlySeries(expenses: Expense[], currentMonth: string): MonthAggregate[] {
  const map = new Map<string, MonthAggregate>();
  for (const e of expenses) {
    const m = monthKeyFromIso(e.date);
    const agg = map.get(m) ?? { month: m, paid: 0, planned: 0 };
    if (e.status === "PAID") agg.paid += e.amount;
    else agg.planned += e.amount;
    map.set(m, agg);
  }

  const keys = [...map.keys(), currentMonth];
  const minKey = keys.reduce((a, b) => (a < b ? a : b));
  const maxKey = keys.reduce((a, b) => (a > b ? a : b));

  const out: MonthAggregate[] = [];
  const [minY, minM] = minKey.split("-").map(Number);
  const [maxY, maxM] = maxKey.split("-").map(Number);
  let y = minY;
  let m = minM;
  // Guard against runaway loops.
  for (let i = 0; i < 60; i++) {
    const key = `${y}-${String(m).padStart(2, "0")}`;
    out.push(map.get(key) ?? { month: key, paid: 0, planned: 0 });
    if (y === maxY && m === maxM) break;
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}
