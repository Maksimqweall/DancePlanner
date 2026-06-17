import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';

// 1. Описываем типы данных (наш фундамент)
export type Category = 'HOTEL' | 'ENTRY_FEE' | 'TRAVEL' | 'DRESS' | 'LESSON' | 'OTHER';

export interface Transaction {
  id: string;
  amount: number;
  category: Category;
  description: string;
  date: string; // ISO формат (например: 2026-08-10T14:00:00Z)
  isSynced: boolean; // Для будущей отправки на бэкенд
}

interface FinanceState {
  transactions: Transaction[];
  addTransaction: (amount: number, category: Category, description: string) => void;
  deleteTransaction: (id: string) => void;
  // Полезная функция для мгновенного подсчета расходов за месяц
  getTotalSpent: () => number; 
}

// 2. Создаем само хранилище с магией persist (сохранение в память)
export const useFinanceStore = create<FinanceState>()(
  persist(
    (set, get) => ({
      transactions: [],

      // Добавление новой траты
      addTransaction: (amount, category, description) => {
        const newTx: Transaction = {
          id: crypto.randomUUID(),
          amount,
          category,
          description,
          date: new Date().toISOString(),
          isSynced: false,
        };
        
        set((state) => ({
          transactions: [newTx, ...state.transactions], // Новые добавляем в начало списка
        }));
      },

      // Удаление траты (если ошибся)
      deleteTransaction: (id) => {
        set((state) => ({
          transactions: state.transactions.filter((tx) => tx.id !== id),
        }));
      },

      // Считаем общую сумму всех трат
      getTotalSpent: () => {
        return get().transactions.reduce((sum, tx) => sum + tx.amount, 0);
      },
    }),
    {
      name: 'dance-planner-finance-storage', // Имя файла в памяти телефона
      storage: createJSONStorage(() => AsyncStorage), // Указываем, что используем хранилище React Native
    }
  )
);