import { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Alert, Platform, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import Animated, {
  FadeInDown,
  useSharedValue, withTiming, withDelay, useAnimatedStyle, Easing,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import {
  useFinanceStore,
  monthlySeries,
  summarizeMonth,
} from "../../../store/useFinanceStore";
import { useProjectStore } from "../../../store/useProjectStore";
import { usePartnerStore } from "../../../store/usePartnerStore";
import { useAuthStore } from "../../../store/useAuthStore";
import TransactionCard from "../../../components/TransactionCard";
import ExpenseFormModal from "../../../components/ExpenseFormModal";
import MonthlyBarChart from "../../../components/MonthlyBarChart";
import { AnimatedProgress } from "../../../components/ui/AnimatedProgress";
import {
  monthLong, monthKeyFromIso, formatMoney, currentMonthKey,
  CATEGORY_META, CATEGORY_ORDER,
} from "../../../lib/display";
import type { Category, Expense } from "../../../lib/types";
import PressableScale from "../../../components/ui/PressableScale";
import type { Palette } from "../../../lib/theme";
import { useC } from "../../../lib/useTheme";
import { useT } from "../../../lib/i18n";

type Period = "3M" | "6M" | "1Y";

interface MonthGroup {
  month: string;
  items: Expense[];
  paid: number;
  planned: number;
}

const CAT_COLORS = ["#6366F1", "#A855F7", "#F59E0B", "#EF4444", "#10B981", "#3B82F6", "#EC4899"];

function periodCutoff(period: Period): Date {
  const now = new Date();
  const months = period === "3M" ? 3 : period === "6M" ? 6 : 12;
  const d = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Animated ring using a stroke-based approach via two nested circles
function BudgetRing({ progress, color, size = 72 }: { progress: number; color: string; size?: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(400, withTiming(Math.min(1, Math.max(0, progress)), { duration: 1100, easing: Easing.out(Easing.cubic) }));
  }, [progress]);
  const arcStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${p.value * 360}deg` }],
    opacity: p.value > 0 ? 1 : 0,
  }));
  const pct = Math.round(progress * 100);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 5, borderColor: "rgba(255,255,255,0.18)", position: "absolute" }} />
      <Animated.View style={[{
        width: size, height: size, borderRadius: size / 2,
        borderWidth: 5, borderColor: "transparent",
        borderTopColor: "rgba(255,255,255,0.85)",
        position: "absolute",
      }, arcStyle]} />
      <Text style={{ color: "#fff", fontSize: 18, fontWeight: "900", letterSpacing: -0.5 }}>{pct}%</Text>
    </View>
  );
}

export default function ExpensesScreen() {
  const C = useC();
  const T = useT();
  const styles = useMemo(() => makeStyles(C), [C]);
  const catChipStyles = useMemo(() => makeCatStyles(C), [C]);

  const { expenses, budgets, refresh, addExpense, deleteExpense } = useFinanceStore();
  const { projects, refreshProjects } = useProjectStore();
  const { couple, createProposal } = usePartnerStore();
  const user = useAuthStore((st) => st.user);

  const [period, setPeriod] = useState<Period>("3M");
  const [filterCat, setFilterCat] = useState<Category | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([currentMonthKey()]));
  const [modalOpen, setModalOpen] = useState(false);

  useFocusEffect(useCallback(() => { refresh(); refreshProjects(); }, [refresh, refreshProjects]));

  const defaultBudget = user?.monthlyBudget ?? 1000;
  const budgetForMonth = useCallback((m: string) => budgets[m] ?? defaultBudget, [budgets, defaultBudget]);

  // ── Hero: current-month stats ──────────────────────────────────────────────
  const currentMon = currentMonthKey();
  const summary = useMemo(() => summarizeMonth(expenses, currentMon), [expenses, currentMon]);
  const monthBudget = budgetForMonth(currentMon);
  const budgetProgress = monthBudget > 0 ? summary.paid / monthBudget : 0;
  const budgetLeft = Math.max(0, monthBudget - summary.paid);
  const isOverBudget = summary.paid > monthBudget && monthBudget > 0;
  const monthPlanned = useMemo(
    () => expenses.filter(e => monthKeyFromIso(e.date) === currentMon && e.status === "PLANNED")
                  .reduce((s, e) => s + e.amount, 0),
    [expenses, currentMon],
  );

  // ── Filtered period data ───────────────────────────────────────────────────
  const cutoff = useMemo(() => periodCutoff(period), [period]);
  const filteredExpenses = useMemo(
    () => expenses.filter(e => new Date(e.date) >= cutoff),
    [expenses, cutoff],
  );
  const categoryFilteredExpenses = useMemo(
    () => filterCat ? filteredExpenses.filter(e => e.category === filterCat) : filteredExpenses,
    [filteredExpenses, filterCat],
  );
  const presentCategories = useMemo(
    () => CATEGORY_ORDER.filter(c => filteredExpenses.some(e => e.category === c)),
    [filteredExpenses],
  );

  // ── Category breakdown ─────────────────────────────────────────────────────
  const categoryBreakdown = useMemo(() => {
    const map: Partial<Record<Category, number>> = {};
    for (const e of filteredExpenses) {
      if (e.status === "PAID") map[e.category] = (map[e.category] ?? 0) + e.amount;
    }
    const maxVal = Math.max(...(Object.values(map) as number[]), 1);
    return CATEGORY_ORDER
      .filter(c => (map[c] ?? 0) > 0)
      .map(c => ({ cat: c, amount: map[c]!, ratio: (map[c]! / maxVal) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [filteredExpenses]);

  const groups = useMemo<MonthGroup[]>(() => {
    const map = new Map<string, MonthGroup>();
    for (const e of categoryFilteredExpenses) {
      const m = monthKeyFromIso(e.date);
      const g = map.get(m) ?? { month: m, items: [], paid: 0, planned: 0 };
      g.items.push(e);
      if (e.status === "PAID") g.paid += e.amount;
      else g.planned += e.amount;
      map.set(m, g);
    }
    return [...map.values()].sort((a, b) => (a.month < b.month ? 1 : -1));
  }, [categoryFilteredExpenses]);

  const periodTotals = useMemo(() => ({
    paid: categoryFilteredExpenses.filter(e => e.status === "PAID").reduce((s, e) => s + e.amount, 0),
    planned: categoryFilteredExpenses.filter(e => e.status === "PLANNED").reduce((s, e) => s + e.amount, 0),
  }), [categoryFilteredExpenses]);

  const series = useMemo(
    () => monthlySeries(categoryFilteredExpenses, currentMonthKey()),
    [categoryFilteredExpenses],
  );

  const toggleMonth = (month: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(month) ? n.delete(month) : n.add(month); return n; });

  const confirmDelete = (id: string) => {
    if (Platform.OS === "web") { deleteExpense(id); return; }
    Alert.alert(T.finance.deleteExpense, T.finance.deleteConfirm, [
      { text: T.common.cancel, style: "cancel" },
      { text: T.common.delete, style: "destructive", onPress: () => deleteExpense(id) },
    ]);
  };

  const heroColors: [string, string] = isOverBudget
    ? [`${C.red}F0`, `${C.red}A0`]
    : [C.accent, C.purple];

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>

        {/* ── Title ────────────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(0).duration(400)} style={styles.titleRow}>
          <Text style={styles.pageTitle}>{T.finance.title}</Text>
          <PressableScale style={styles.addBtn} onPress={() => setModalOpen(true)}>
            <Text style={styles.addBtnText}>+ {T.common.add}</Text>
          </PressableScale>
        </Animated.View>

        {/* ── Hero Budget Card ─────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(40).duration(500)}>
          <LinearGradient
            colors={heroColors}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroTop}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroLabel}>{T.finance.thisMonth}</Text>
                <Text style={styles.heroAmount}>{formatMoney(summary.paid)}</Text>
                <View style={styles.heroChipsRow}>
                  {monthPlanned > 0 && (
                    <View style={styles.heroChip}>
                      <Text style={styles.heroChipText}>+{formatMoney(monthPlanned)} {T.finance.planned.toLowerCase()}</Text>
                    </View>
                  )}
                  <View style={[styles.heroChip, isOverBudget && styles.heroChipOver]}>
                    <Text style={styles.heroChipText}>
                      {isOverBudget
                        ? `▲ ${T.finance.overBudget} ${formatMoney(summary.paid - monthBudget)}`
                        : `${formatMoney(budgetLeft)} ${T.finance.leftLabel}`}
                    </Text>
                  </View>
                </View>
              </View>
              <BudgetRing progress={budgetProgress} color="#fff" size={80} />
            </View>
            <View style={{ marginTop: 16 }}>
              <Text style={styles.heroBarLabel}>{T.finance.budgetUsage} · {formatMoney(summary.paid)} {T.finance.of} {formatMoney(monthBudget)}</Text>
              <AnimatedProgress
                progress={Math.min(1, budgetProgress)}
                track="rgba(255,255,255,0.18)"
                fill="rgba(255,255,255,0.88)"
                height={7}
                delay={400}
                duration={1000}
              />
            </View>
          </LinearGradient>
        </Animated.View>

        {/* ── Period selector ──────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(80).duration(400)}>
          <View style={styles.periodRow}>
            {(["3M", "6M", "1Y"] as const).map(p => (
              <PressableScale
                key={p}
                onPress={() => setPeriod(p)}
                style={[styles.periodBtn, period === p && styles.periodBtnActive]}
              >
                <Text style={[styles.periodBtnText, period === p && styles.periodBtnTextActive]}>{p}</Text>
              </PressableScale>
            ))}
          </View>
        </Animated.View>

        {/* ── Category Breakdown ───────────────────────────────────────────── */}
        {categoryBreakdown.length > 0 && (
          <Animated.View entering={FadeInDown.delay(110).duration(400)}>
            <View style={styles.breakdownCard}>
              <Text style={styles.sectionLabel}>{T.finance.categoryBreakdown}</Text>
              {categoryBreakdown.map((item, i) => {
                const meta = CATEGORY_META[item.cat];
                const color = CAT_COLORS[i % CAT_COLORS.length];
                return (
                  <View key={item.cat} style={styles.catRow}>
                    <View style={[styles.catIconBg, { backgroundColor: `${color}22` }]}>
                      <Text style={styles.catIcon}>{meta.icon}</Text>
                    </View>
                    <View style={styles.catBarCol}>
                      <View style={styles.catLabelRow}>
                        <Text style={styles.catName}>{meta.label}</Text>
                        <Text style={[styles.catAmount, { color }]}>{formatMoney(item.amount)}</Text>
                      </View>
                      <AnimatedProgress
                        progress={item.ratio}
                        track={C.elevated}
                        fill={color}
                        height={5}
                        delay={i * 90 + 350}
                        duration={900}
                      />
                    </View>
                  </View>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* ── Category filter chips ────────────────────────────────────────── */}
        {presentCategories.length > 1 && (
          <Animated.View entering={FadeInDown.delay(130).duration(400)}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={catChipStyles.scroll} contentContainerStyle={catChipStyles.row}>
              <PressableScale onPress={() => setFilterCat(null)} style={[catChipStyles.chip, !filterCat && catChipStyles.chipActive]}>
                <Text style={[catChipStyles.chipText, !filterCat && catChipStyles.chipTextActive]}>{T.finance.allCategories}</Text>
              </PressableScale>
              {presentCategories.map(c => {
                const m = CATEGORY_META[c];
                const active = filterCat === c;
                return (
                  <PressableScale
                    key={c}
                    onPress={() => setFilterCat(active ? null : c)}
                    style={[catChipStyles.chip, active && catChipStyles.chipActive]}
                  >
                    <Text style={[catChipStyles.chipText, active && catChipStyles.chipTextActive]}>{m.icon} {m.label}</Text>
                  </PressableScale>
                );
              })}
            </ScrollView>
          </Animated.View>
        )}

        {/* ── Period totals + chart ────────────────────────────────────────── */}
        {filteredExpenses.length > 0 && (
          <Animated.View entering={FadeInDown.delay(150).duration(400)}>
            <View style={styles.totalsRow}>
              <View style={styles.totalItem}>
                <Text style={styles.totalLabel}>{T.finance.paid.toUpperCase()}</Text>
                <Text style={styles.totalAmount}>{formatMoney(periodTotals.paid)}</Text>
              </View>
              {periodTotals.planned > 0 && (
                <>
                  <View style={styles.totalDivider} />
                  <View style={styles.totalItem}>
                    <Text style={styles.totalLabel}>{T.finance.planned.toUpperCase()}</Text>
                    <Text style={[styles.totalAmount, { color: C.gold }]}>{formatMoney(periodTotals.planned)}</Text>
                  </View>
                </>
              )}
            </View>

            <View style={styles.chartCard}>
              <MonthlyBarChart
                data={series}
                selectedMonth={currentMonthKey()}
                onSelect={m => setExpanded(prev => new Set([...prev, m]))}
                budgetForMonth={budgetForMonth}
              />
            </View>
          </Animated.View>
        )}

        {/* ── Month accordion ──────────────────────────────────────────────── */}
        {groups.length === 0 ? (
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>💳</Text>
            <Text style={styles.emptyTitle}>{T.finance.noExpensesInPeriod}</Text>
            <Text style={styles.emptyText}>{T.finance.tapToRecord}</Text>
          </Animated.View>
        ) : (
          groups.map((g, gi) => (
            <Animated.View
              key={g.month}
              entering={gi < 6 ? FadeInDown.delay(gi * 55 + 200).duration(360) : undefined}
            >
              <PressableScale onPress={() => toggleMonth(g.month)} style={styles.monthHeader}>
                <View style={styles.monthHeaderLeft}>
                  <Text style={styles.monthLabel}>{monthLong(g.month)}</Text>
                  <View style={styles.monthAmounts}>
                    <Text style={styles.monthPaid}>{formatMoney(g.paid)}</Text>
                    {g.planned > 0 && <Text style={styles.monthPlanned}>+{formatMoney(g.planned)} {T.finance.planned.toLowerCase()}</Text>}
                  </View>
                </View>
                <Text style={styles.monthChevron}>{expanded.has(g.month) ? "▼" : "▶"}</Text>
              </PressableScale>
              {expanded.has(g.month) && g.items.map((tx, i) => (
                <TransactionCard key={tx.id} expense={tx} onDelete={confirmDelete} index={i} />
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
        onProposal={couple ? createProposal : undefined}
        hasPartner={!!couple}
        partnerName={couple ? couple.partner.firstName : undefined}
        projects={projects.map(p => ({ id: p.id, title: p.title }))}
      />
    </View>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  titleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  pageTitle: { color: C.t1, fontSize: 30, fontWeight: "900", letterSpacing: -0.8 },
  addBtn: { backgroundColor: C.accent, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14 },
  addBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  // Hero
  heroCard: {
    borderRadius: 28, padding: 22, marginBottom: 16,
    shadowColor: C.accent, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4, shadowRadius: 24, elevation: 12,
  },
  heroTop: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  heroLabel: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "700", letterSpacing: 1.2, marginBottom: 6 },
  heroAmount: { color: "#fff", fontSize: 36, fontWeight: "900", letterSpacing: -1, marginBottom: 12 },
  heroChipsRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  heroChip: { backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  heroChipOver: { backgroundColor: "rgba(0,0,0,0.22)" },
  heroChipText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  heroBarLabel: { color: "rgba(255,255,255,0.55)", fontSize: 11, marginBottom: 8, fontWeight: "500" },
  // Period
  periodRow: {
    flexDirection: "row", backgroundColor: C.card, borderRadius: 14,
    padding: 4, marginBottom: 16, borderWidth: 1, borderColor: C.border,
  },
  periodBtn: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: "center" },
  periodBtnActive: { backgroundColor: C.elevated },
  periodBtnText: { color: C.t3, fontWeight: "600", fontSize: 14 },
  periodBtnTextActive: { color: C.t1 },
  // Category breakdown
  breakdownCard: {
    backgroundColor: C.card, borderRadius: 24, padding: 18,
    marginBottom: 16, borderWidth: 1, borderColor: C.borderStrong,
  },
  sectionLabel: { color: C.t3, fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 16 },
  catRow: { flexDirection: "row", alignItems: "center", marginBottom: 14, gap: 12 },
  catIconBg: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  catIcon: { fontSize: 18 },
  catBarCol: { flex: 1 },
  catLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  catName: { color: C.t2, fontSize: 13, fontWeight: "500" },
  catAmount: { fontSize: 13, fontWeight: "700" },
  // Totals
  totalsRow: {
    flexDirection: "row", backgroundColor: C.card, borderRadius: 18,
    padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.borderStrong,
  },
  totalItem: { flex: 1, alignItems: "center" },
  totalDivider: { width: 1, backgroundColor: C.border, marginVertical: 4 },
  totalLabel: { color: C.t3, fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginBottom: 6 },
  totalAmount: { color: C.t1, fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },
  // Chart
  chartCard: { backgroundColor: C.card, borderRadius: 20, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: C.border },
  // Empty
  emptyCard: { backgroundColor: C.card, borderRadius: 20, padding: 24, alignItems: "center", borderWidth: 1, borderColor: C.border },
  emptyEmoji: { fontSize: 32, textAlign: "center", marginBottom: 12 },
  emptyTitle: { color: C.t1, fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptyText: { color: C.t2, fontSize: 14, textAlign: "center" },
  // Month accordion
  monthHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 12, paddingHorizontal: 4, marginTop: 6, marginBottom: 4,
  },
  monthHeaderLeft: { flex: 1 },
  monthLabel: { color: C.t1, fontWeight: "700", fontSize: 17, marginBottom: 2 },
  monthAmounts: { flexDirection: "row", alignItems: "center", gap: 8 },
  monthPaid: { color: C.t2, fontWeight: "600", fontSize: 14 },
  monthPlanned: { color: C.gold, fontSize: 13, fontWeight: "500" },
  monthChevron: { color: C.t3, fontSize: 13, marginLeft: 8 },
  });
}

function makeCatStyles(C: Palette) {
  return StyleSheet.create({
  scroll: { marginBottom: 14 },
  row: { gap: 8, paddingVertical: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  chipActive: { backgroundColor: C.accentFade, borderColor: C.accentBorder },
  chipText: { color: C.t2, fontSize: 13, fontWeight: "500" },
  chipTextActive: { color: C.accent, fontWeight: "700" },
  });
}
