import { create } from "zustand";
import { api } from "../lib/api";
import type {
  Category,
  Expense,
  ExpenseStatus,
  Summary,
  ForecastMonth,
} from "../lib/types";

export interface CreateExpenseInput {
  title?: string;
  category: Category;
  amount: number;
  date: string; // ISO
  description?: string;
  status: ExpenseStatus;
  eventId?: string | null;
}

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface FinanceState {
  expenses: Expense[];
  summary: Summary | null;
  forecast: ForecastMonth[];
  monthlyLimit: number;
  loading: boolean;

  refresh: () => Promise<void>;
  addExpense: (input: CreateExpenseInput) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  setMonthlyLimit: (limit: number) => void;
}

export const useFinanceStore = create<FinanceState>((set, get) => ({
  expenses: [],
  summary: null,
  forecast: [],
  monthlyLimit: 1000, // TODO: move to a profile/settings module
  loading: false,

  refresh: async () => {
    set({ loading: true });
    try {
      const month = currentMonthKey();
      const [expensesRes, summaryRes, forecastRes] = await Promise.all([
        api.get<{ expenses: Expense[] }>("/expenses"),
        api.get<Summary>(`/expenses/summary?month=${month}`),
        api.get<{ forecast: ForecastMonth[] }>("/expenses/forecast"),
      ]);
      set({
        expenses: expensesRes.expenses,
        summary: summaryRes,
        forecast: forecastRes.forecast,
      });
    } finally {
      set({ loading: false });
    }
  },

  addExpense: async (input) => {
    await api.post("/expenses", input);
    await get().refresh();
  },

  deleteExpense: async (id) => {
    // Optimistic removal, then refresh aggregates.
    set((state) => ({ expenses: state.expenses.filter((e) => e.id !== id) }));
    await api.del(`/expenses/${id}`);
    await get().refresh();
  },

  setMonthlyLimit: (limit) => set({ monthlyLimit: limit }),
}));
