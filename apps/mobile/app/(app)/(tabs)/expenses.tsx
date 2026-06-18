import { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Alert, Platform } from "react-native";
import { useFocusEffect } from "expo-router";
import { useFinanceStore } from "../../../store/useFinanceStore";
import { useProjectStore } from "../../../store/useProjectStore";
import TransactionCard from "../../../components/TransactionCard";
import ExpenseFormModal from "../../../components/ExpenseFormModal";
import { monthLong, monthKeyFromIso, formatMoney } from "../../../lib/display";
import type { Expense } from "../../../lib/types";

interface MonthGroup {
  month: string;
  items: Expense[];
  paid: number;
  planned: number;
}

export default function ExpensesScreen() {
  const { expenses, refresh, addExpense, deleteExpense } = useFinanceStore();
  const { projects, refreshProjects } = useProjectStore();
  const [modalOpen, setModalOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshProjects();
    }, [refresh, refreshProjects])
  );

  // Group expenses into months (most recent first).
  const groups = useMemo<MonthGroup[]>(() => {
    const map = new Map<string, MonthGroup>();
    for (const e of expenses) {
      const m = monthKeyFromIso(e.date);
      const g = map.get(m) ?? { month: m, items: [], paid: 0, planned: 0 };
      g.items.push(e);
      if (e.status === "PAID") g.paid += e.amount;
      else g.planned += e.amount;
      map.set(m, g);
    }
    return [...map.values()].sort((a, b) => (a.month < b.month ? 1 : -1));
  }, [expenses]);

  const confirmDelete = (id: string) => {
    if (Platform.OS === "web") {
      deleteExpense(id);
      return;
    }
    Alert.alert("Delete expense", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteExpense(id) },
    ]);
  };

  return (
    <View className="flex-1 bg-zinc-900">
      <ScrollView className="flex-1 px-4 pt-4">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-2xl text-white font-bold">Expenses</Text>
          <TouchableOpacity
            className="bg-emerald-500 px-4 py-2 rounded-xl"
            onPress={() => setModalOpen(true)}
          >
            <Text className="text-white font-bold">+ Add</Text>
          </TouchableOpacity>
        </View>

        {groups.length === 0 ? (
          <Text className="text-zinc-500 text-center mt-10">
            No expenses yet. Tap “+ Add” to record one.
          </Text>
        ) : (
          groups.map((g) => (
            <View key={g.month} className="mb-4">
              {/* Month header */}
              <View className="flex-row justify-between items-end mb-2 mt-2">
                <Text className="text-zinc-300 font-semibold text-base">{monthLong(g.month)}</Text>
                <View className="flex-row items-center">
                  <Text className="text-white font-bold">{formatMoney(g.paid)}</Text>
                  {g.planned > 0 ? (
                    <Text className="text-amber-400 text-sm ml-2">
                      +{formatMoney(g.planned)} planned
                    </Text>
                  ) : null}
                </View>
              </View>
              {g.items.map((tx) => (
                <TransactionCard key={tx.id} expense={tx} onDelete={confirmDelete} />
              ))}
            </View>
          ))
        )}
        <View className="h-10" />
      </ScrollView>

      <ExpenseFormModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={addExpense}
        projects={projects.map((p) => ({ id: p.id, title: p.title }))}
      />
    </View>
  );
}
