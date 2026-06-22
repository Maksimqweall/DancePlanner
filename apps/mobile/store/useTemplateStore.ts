import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Category } from "../lib/types";

export interface ExpenseTemplate {
  id: string;
  title: string;
  amount: number;
  category: Category;
}

interface TemplateState {
  templates: ExpenseTemplate[];
  addTemplate: (input: Omit<ExpenseTemplate, "id">) => void;
  deleteTemplate: (id: string) => void;
}

export const useTemplateStore = create<TemplateState>()(
  persist(
    (set) => ({
      templates: [],

      addTemplate: (input) =>
        set((state) => ({
          templates: [
            ...state.templates,
            { ...input, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` },
          ],
        })),

      deleteTemplate: (id) =>
        set((state) => ({
          templates: state.templates.filter((t) => t.id !== id),
        })),
    }),
    {
      name: "danceplanner.templates",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
