import { create } from "zustand";
import { api } from "../lib/api";
import type { Category, Expense, ScheduleEntry, SessionType } from "../lib/types";

export interface CreateScheduleInput {
  title: string;
  type: SessionType;
  date: string; // ISO
  endDate?: string | null; // ISO, for multi-day events
  startTime?: string | null;
  endTime?: string | null;
  allDay?: boolean;
  location?: string | null;
  notes?: string | null;
  eventId?: string | null;
  cost?: number | null;
  category?: Category | null;
  coupleEntry?: boolean;
  paidBy?: "ME" | "PARTNER";
}

export function monthKeyOf(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

interface ScheduleState {
  viewMonth: string; // YYYY-MM currently shown
  entries: ScheduleEntry[];
  monthExpenses: Expense[];
  loading: boolean;

  fetchMonth: (month: string) => Promise<void>;
  createEntry: (input: CreateScheduleInput) => Promise<void>;
  updateEntry: (id: string, input: Partial<CreateScheduleInput>) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  viewMonth: monthKeyOf(new Date()),
  entries: [],
  monthExpenses: [],
  loading: false,

  fetchMonth: async (month) => {
    set({ loading: true, viewMonth: month });
    try {
      const [entriesRes, expensesRes] = await Promise.all([
        api.get<{ entries: ScheduleEntry[] }>(`/schedule?month=${month}`),
        api.get<{ expenses: Expense[] }>(`/expenses?month=${month}`),
      ]);
      set({ entries: entriesRes.entries, monthExpenses: expensesRes.expenses });
    } finally {
      set({ loading: false });
    }
  },

  createEntry: async (input) => {
    await api.post("/schedule", input);
    await get().fetchMonth(get().viewMonth);
  },

  updateEntry: async (id, input) => {
    await api.patch(`/schedule/${id}`, input);
    await get().fetchMonth(get().viewMonth);
  },

  deleteEntry: async (id) => {
    await api.del(`/schedule/${id}`);
    await get().fetchMonth(get().viewMonth);
  },
}));
