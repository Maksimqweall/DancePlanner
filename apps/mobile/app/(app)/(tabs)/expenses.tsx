import { useCallback, useMemo, useState } from "react";
import { View, Text, ScrollView, Alert, Platform, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  useFinanceStore,
  monthlySeries,
} from "../../../store/useFinanceStore";
import { useProjectStore } from "../../../store/useProjectStore";
import { usePartnerStore } from "../../../store/usePartnerStore";
import { useAuthStore } from "../../../store/useAuthStore";
import TransactionCard from "../../../components/TransactionCard";
import ExpenseFormModal from "../../../components/ExpenseFormModal";
import MonthlyBarChart from "../../../components/MonthlyBarChart";
import { monthLong, monthKeyFromIso, formatMoney, currentMonthKey } from "../../../lib/display";
import type { Expense } from "../../../lib/types";
import PressableScale from "../../../components/ui/PressableScale";
import { C } from "../../../lib/theme";

type Period = "3M" | "6M" | "1Y";

interface MonthGroup {
  month: string;
  items: Expense[];
  paid: number;
  planned: number;
}

function periodCutoff(period: Period): Date {
  const now = new Date();
  const months = period === "3M" ? 3 : period === "6M" ? 6 : 12;
  const d = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function ExpensesScreen() {
  const { expenses, budgets, refresh, addExpense, deleteExpense } = useFinanceStore();
  const { projects, refreshProjects } = useProjectStore();
  const { couple, createProposal } = usePartnerStore();
  const user = useAuthStore((s) => s.user);

  const [period, setPeriod] = useState<Period>("3M");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([currentMonthKey()]));
  const [modalOpen, setModalOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshProjects();
    }, [refresh, refreshProjects])
  );

  const cutoff = useMemo(() => periodCutoff(period), [period]);

  const filteredExpenses = useMemo(
    () => expenses.filter((e) => new Date(e.date) >= cutoff),
    [expenses, cutoff]
  );

  const groups = useMemo<MonthGroup[]>(() => {
    const map = new Map<string, MonthGroup>();
    for (const e of filteredExpenses) {
      const m = monthKeyFromIso(e.date);
      const g = map.get(m) ?? { month: m, items: [], paid: 0, planned: 0 };
      g.items.push(e);
      if (e.status === "PAID") g.paid += e.amount;
      else g.planned += e.amount;
      map.set(m, g);
    }
    return [...map.values()].sort((a, b) => (a.month < b.month ? 1 : -1));
  }, [filteredExpenses]);

  const periodTotals = useMemo(() => ({
    paid: filteredExpenses.filter((e) => e.status === "PAID").reduce((s, e) => s + e.amount, 0),
    planned: filteredExpenses.filter((e) => e.status === "PLANNED").reduce((s, e) => s + e.amount, 0),
  }), [filteredExpenses]);

  const defaultBudget = user?.monthlyBudget ?? 1000;
  const budgetForMonth = useCallback(
    (m: string) => budgets[m] ?? defaultBudget,
    [budgets, defaultBudget]
  );

  const series = useMemo(() => monthlySeries(filteredExpenses, currentMonthKey()), [filteredExpenses]);

  const toggleMonth = (month: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  };

  const onChartSelect = (month: string) => {
    setExpanded((prev) => new Set([...prev, month]));
  };

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
        {/* Title */}
        <Animated.View entering={FadeInDown.delay(0).duration(400)} style={styles.titleRow}>
          <Text style={styles.pageTitle}>Finance</Text>
          <PressableScale style={styles.addBtn} onPress={() => setModalOpen(true)}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </PressableScale>
        </Animated.View>

        {/* Period selector */}
        <Animated.View entering={FadeInDown.delay(40).duration(400)}>
          <View style={styles.periodRow}>
            {(["3M", "6M", "1Y"] as const).map((p) => (
              <PressableScale
                key={p}
                onPress={() => setPeriod(p)}
                style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              >
                <Text style={[styles.periodBtnText, period === p && styles.periodBtnTextActive]}>
                  {p}
                </Text>
              </PressableScale>
            ))}
          </View>
        </Animated.View>

        {/* Stats + chart */}
        {filteredExpenses.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(80).duration(400)}>
            <View style={styles.statsRow}>
              <View style={styles.statsItem}>
                <Text style={styles.statsLabel}>Paid</Text>
                <Text style={styles.statsAmount}>{formatMoney(periodTotals.paid)}</Text>
              </View>
              {periodTotals.planned > 0 ? (
                <>
                  <View style={styles.statsDivider} />
                  <View style={styles.statsItem}>
                    <Text style={styles.statsLabel}>Planned</Text>
                    <Text style={[styles.statsAmount, { color: C.gold }]}>
                      {formatMoney(periodTotals.planned)}
                    </Text>
                  </View>
                </>
              ) : null}
            </View>

            <View style={styles.chartCard}>
              <MonthlyBarChart
                data={series}
                selectedMonth={currentMonthKey()}
                onSelect={onChartSelect}
                budgetForMonth={budgetForMonth}
              />
            </View>
          </Animated.View>
        ) : null}

        {/* Month accordion */}
        {groups.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>💳</Text>
            <Text style={styles.emptyTitle}>No expenses in this period</Text>
            <Text style={styles.emptyText}>Tap "+ Add" to record your first expense.</Text>
          </Animated.View>
        ) : (
          groups.map((g, gi) => (
            <Animated.View
              key={g.month}
              entering={gi < 6 ? FadeInDown.delay(gi * 55 + 120).duration(360) : undefined}
            >
              <PressableScale onPress={() => toggleMonth(g.month)} style={styles.monthHeader}>
                <View style={styles.monthHeaderLeft}>
                  <Text style={styles.monthLabel}>{monthLong(g.month)}</Text>
                  <View style={styles.monthAmounts}>
                    <Text style={styles.monthPaid}>{formatMoney(g.paid)}</Text>
                    {g.planned > 0 ? (
                      <Text style={styles.monthPlanned}>+{formatMoney(g.planned)} planned</Text>
                    ) : null}
                  </View>
                </View>
                <Text style={styles.monthChevron}>
                  {expanded.has(g.month) ? "▼" : "▶"}
                </Text>
              </PressableScale>

              {expanded.has(g.month)
                ? g.items.map((tx, i) => (
                    <TransactionCard
                      key={tx.id}
                      expense={tx}
                      onDelete={confirmDelete}
                      index={i}
                    />
                  ))
                : null}
            </Animated.View>
          ))
        )}

        <View style={{ height: 24 }} />
      </ScrollView>

      <ExpenseFormModal
        visible={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={addExpense}
        onProposal={couple ? createProposal : undefined}
        hasPartner={!!couple}
        partnerName={couple ? couple.partner.firstName : undefined}
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  pageTitle: { color: C.t1, fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  addBtn: {
    backgroundColor: C.accent,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
  },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  // Period selector
  periodRow: {
    flexDirection: "row",
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: "center",
  },
  periodBtnActive: { backgroundColor: C.elevated },
  periodBtnText: { color: C.t3, fontWeight: "600", fontSize: 14 },
  periodBtnTextActive: { color: C.t1 },
  // Stats
  statsRow: {
    flexDirection: "row",
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  statsItem: { flex: 1, alignItems: "center" },
  statsDivider: { width: 1, backgroundColor: C.border, marginVertical: 4 },
  statsLabel: { color: C.t2, fontSize: 12, fontWeight: "500", marginBottom: 6 },
  statsAmount: { color: C.t1, fontSize: 22, fontWeight: "800", letterSpacing: -0.5 },
  // Chart
  chartCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: C.border,
  },
  // Empty
  emptyCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  emptyEmoji: { fontSize: 32, textAlign: "center", marginBottom: 12 },
  emptyTitle: { color: C.t1, fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptyText: { color: C.t2, fontSize: 14, textAlign: "center" },
  // Month accordion
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 4,
    marginTop: 6,
    marginBottom: 4,
  },
  monthHeaderLeft: { flex: 1 },
  monthLabel: { color: C.t1, fontWeight: "700", fontSize: 17, marginBottom: 2 },
  monthAmounts: { flexDirection: "row", alignItems: "center", gap: 8 },
  monthPaid: { color: C.t2, fontWeight: "600", fontSize: 14 },
  monthPlanned: { color: C.gold, fontSize: 13, fontWeight: "500" },
  monthChevron: { color: C.t3, fontSize: 13, marginLeft: 8 },
});
