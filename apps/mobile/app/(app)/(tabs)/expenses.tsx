import { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, Alert, Platform, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useFinanceStore } from "../../../store/useFinanceStore";
import { useProjectStore } from "../../../store/useProjectStore";
import TransactionCard from "../../../components/TransactionCard";
import ExpenseFormModal from "../../../components/ExpenseFormModal";
import { monthLong, monthKeyFromIso, formatMoney } from "../../../lib/display";
import type { Expense } from "../../../lib/types";
import PressableScale from "../../../components/ui/PressableScale";
import { C } from "../../../lib/theme";

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
    if (Platform.OS === "web") { deleteExpense(id); return; }
    Alert.alert("Delete expense", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteExpense(id) },
    ]);
  };

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Animated.View entering={FadeInDown.delay(0).duration(400)} style={styles.titleRow}>
          <Text style={styles.pageTitle}>Finance</Text>
          <PressableScale style={styles.addBtn} onPress={() => setModalOpen(true)}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </PressableScale>
        </Animated.View>

        {groups.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(80).duration(400)} style={styles.emptyCard}>
            <Text style={{ fontSize: 32, textAlign: 'center', marginBottom: 12 }}>💳</Text>
            <Text style={styles.emptyTitle}>No expenses yet</Text>
            <Text style={styles.emptyText}>Tap "+ Add" to record your first expense.</Text>
          </Animated.View>
        ) : (
          groups.map((g, gi) => (
            <Animated.View
              key={g.month}
              entering={gi < 4 ? FadeInDown.delay(gi * 80 + 60).duration(380) : undefined}
            >
              <View style={styles.monthHeader}>
                <Text style={styles.monthLabel}>{monthLong(g.month)}</Text>
                <View style={styles.monthAmounts}>
                  <Text style={styles.monthPaid}>{formatMoney(g.paid)}</Text>
                  {g.planned > 0 && (
                    <Text style={styles.monthPlanned}>+{formatMoney(g.planned)} planned</Text>
                  )}
                </View>
              </View>
              {g.items.map((tx, i) => (
                <TransactionCard
                  key={tx.id}
                  expense={tx}
                  onDelete={confirmDelete}
                  index={i}
                />
              ))}
            </Animated.View>
          ))
        )}
        <View style={{ height: 24 }} />
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  pageTitle: { color: C.t1, fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  addBtn: {
    backgroundColor: C.accent,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  emptyCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  emptyTitle: { color: C.t1, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyText: { color: C.t2, fontSize: 14, textAlign: 'center' },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
    marginTop: 16,
    paddingHorizontal: 2,
  },
  monthLabel: { color: C.t1, fontWeight: '700', fontSize: 16 },
  monthAmounts: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthPaid: { color: C.t1, fontWeight: '700', fontSize: 15 },
  monthPlanned: { color: C.gold, fontSize: 13, fontWeight: '500' },
});
