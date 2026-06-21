import { useCallback, useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Modal,
  TextInput,
  StyleSheet,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import {
  useFinanceStore,
  summarizeMonth,
} from "../../../store/useFinanceStore";
import { useAuthStore } from "../../../store/useAuthStore";
import { usePartnerStore } from "../../../store/usePartnerStore";
import ProgressBar from "../../../components/ProgressBar";
import TransactionCard from "../../../components/TransactionCard";
import {
  EVENT_TYPE_META,
  formatMoney,
  monthLong,
  shiftMonth,
  currentMonthKey,
  monthKeyFromIso,
} from "../../../lib/display";
import type { ForecastMonth } from "../../../lib/types";
import PressableScale from "../../../components/ui/PressableScale";
import { C } from "../../../lib/theme";

const DEFAULT_BUDGET = 1000;

export default function Dashboard() {
  const router = useRouter();
  const { forecast, expenses, budgets, refresh, setBudget } = useFinanceStore();
  const user = useAuthStore((s) => s.user);
  const { couple, split, fetchPartner, fetchSplit } = usePartnerStore();

  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());
  const [refreshing, setRefreshing] = useState(false);
  const [budgetModal, setBudgetModal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
      fetchPartner();
    }, [refresh, fetchPartner])
  );

  useEffect(() => {
    if (couple) fetchSplit();
  }, [couple?.id]);

  const defaultBudget = user?.monthlyBudget ?? DEFAULT_BUDGET;
  const budgetForMonth = useCallback(
    (m: string) => budgets[m] ?? defaultBudget,
    [budgets, defaultBudget]
  );
  const budget = budgetForMonth(selectedMonth);
  const summary = useMemo(() => summarizeMonth(expenses, selectedMonth), [expenses, selectedMonth]);
  const monthExpenses = useMemo(
    () => expenses.filter((e) => monthKeyFromIso(e.date) === selectedMonth).slice(0, 6),
    [expenses, selectedMonth]
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try { await refresh(); }
    finally { setRefreshing(false); }
  };

  const isCurrent = selectedMonth === currentMonthKey();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />
      }
    >
      {/* Header */}
      <Animated.View entering={FadeInDown.delay(0).duration(400)} style={styles.header}>
        <View>
          <Text style={styles.welcome}>Welcome back</Text>
          <Text style={styles.userName}>{user?.firstName ?? "Dancer"} 👋</Text>
        </View>
        {couple ? (
          <View style={styles.partnerChip}>
            <View style={styles.partnerDot} />
            <Text style={styles.partnerChipText}>Synced</Text>
          </View>
        ) : null}
      </Animated.View>

      {/* Partner balance widget */}
      {couple && split ? (
        <Animated.View entering={FadeInDown.delay(50).duration(400)}>
          <BalanceWidget split={split} partnerName={couple.partner.firstName} />
        </Animated.View>
      ) : null}

      {/* Month selector */}
      <Animated.View entering={FadeInDown.delay(60).duration(400)} style={styles.monthRow}>
        <PressableScale
          onPress={() => setSelectedMonth((m) => shiftMonth(m, -1))}
          style={styles.monthArrow}
        >
          <Text style={styles.arrowText}>‹</Text>
        </PressableScale>
        <PressableScale onPress={() => setSelectedMonth(currentMonthKey())} style={styles.monthCenter}>
          <Text style={styles.monthText}>{monthLong(selectedMonth)}</Text>
          {!isCurrent && <Text style={styles.monthHint}>tap for current</Text>}
        </PressableScale>
        <PressableScale
          onPress={() => setSelectedMonth((m) => shiftMonth(m, 1))}
          style={styles.monthArrow}
        >
          <Text style={styles.arrowText}>›</Text>
        </PressableScale>
      </Animated.View>

      {/* Budget progress */}
      <Animated.View entering={FadeInDown.delay(100).duration(400)}>
        <ProgressBar spent={summary.paid} limit={budget} />
        <View style={styles.budgetMeta}>
          <Text style={styles.plannedHint}>
            {summary.planned > 0 ? `+ ${formatMoney(summary.planned)} planned` : " "}
          </Text>
          <PressableScale onPress={() => setBudgetModal(true)}>
            <Text style={styles.editBudget}>Edit budget</Text>
          </PressableScale>
        </View>
      </Animated.View>

      {/* Forecast */}
      <Animated.View entering={FadeInDown.delay(150).duration(400)}>
        <Text style={styles.sectionTitle}>Upcoming forecast</Text>
        {forecast.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              No upcoming planned spend. Create a tournament or camp to forecast costs.
            </Text>
          </View>
        ) : (
          forecast.map((m, i) => (
            <ForecastCard
              key={m.month}
              month={m}
              index={i}
              onPressProject={(id) => router.push(`/project/${id}`)}
            />
          ))
        )}
      </Animated.View>

      {/* Expenses */}
      <Animated.View entering={FadeInDown.delay(200).duration(400)}>
        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>Expenses</Text>
          <PressableScale onPress={() => router.push("/expenses")}>
            <Text style={styles.seeAll}>See all →</Text>
          </PressableScale>
        </View>
        {monthExpenses.length === 0 ? (
          <Text style={styles.emptyText}>No expenses in {monthLong(selectedMonth)}.</Text>
        ) : (
          monthExpenses.map((tx, i) => (
            <TransactionCard key={tx.id} expense={tx} index={i} />
          ))
        )}
      </Animated.View>

      <View style={{ height: 24 }} />

      <BudgetModal
        visible={budgetModal}
        current={budget}
        monthLabel={monthLong(selectedMonth)}
        onClose={() => setBudgetModal(false)}
        onSave={(value) => setBudget(selectedMonth, value)}
      />
    </ScrollView>
  );
}

function BalanceWidget({
  split,
  partnerName,
}: {
  split: { balance: number; myTotal: number; partnerTotal: number };
  partnerName: string;
}) {
  const { balance } = split;
  const abs = Math.abs(balance);

  if (abs < 0.01) {
    return (
      <View style={[styles.balanceCard, styles.balanceSquared]}>
        <Text style={styles.balanceSquaredText}>You and {partnerName} are squared up ✓</Text>
      </View>
    );
  }

  const positive = balance > 0;
  const color = positive ? C.accent : C.gold;
  const label = positive
    ? `${partnerName} owes you`
    : `You owe ${partnerName}`;

  return (
    <View
      style={[
        styles.balanceCard,
        {
          backgroundColor: positive ? C.accentFade : C.goldFade,
          borderColor: positive ? C.accentBorder : 'rgba(245,158,11,0.4)',
        },
      ]}
    >
      <View style={styles.balanceLeft}>
        <View style={[styles.balanceDot, { backgroundColor: color }]} />
        <Text style={styles.balanceLabel}>{label}</Text>
      </View>
      <Text style={[styles.balanceAmount, { color }]}>{formatMoney(abs)}</Text>
    </View>
  );
}

function ForecastCard({
  month,
  onPressProject,
  index = 0,
}: {
  month: ForecastMonth;
  onPressProject: (id: string) => void;
  index?: number;
}) {
  return (
    <Animated.View entering={index < 4 ? FadeInDown.delay(index * 60).duration(350) : undefined}>
      <View style={styles.forecastCard}>
        <View style={styles.forecastHeader}>
          <Text style={styles.forecastMonth}>{month.label}</Text>
          <Text style={styles.forecastAmount}>~{formatMoney(month.expected)}</Text>
        </View>
        {month.projects.length > 0 ? (
          <View style={styles.projectPills}>
            {month.projects.map((p) => (
              <PressableScale
                key={p.id}
                onPress={() => onPressProject(p.id)}
                style={styles.projectPill}
              >
                <Text style={styles.projectPillText}>
                  {EVENT_TYPE_META[p.type]?.icon} {p.title}
                </Text>
              </PressableScale>
            ))}
          </View>
        ) : (
          <Text style={{ color: C.t3, fontSize: 13 }}>Planned expenses</Text>
        )}
      </View>
    </Animated.View>
  );
}

function BudgetModal({
  visible,
  current,
  monthLabel,
  onClose,
  onSave,
}: {
  visible: boolean;
  current: number;
  monthLabel: string;
  onClose: () => void;
  onSave: (value: number) => Promise<void>;
}) {
  const [value, setValue] = useState(String(current));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setValue(String(current));
      setError(null);
    }
  }, [visible, current]);

  const save = async () => {
    const n = Number(value.replace(",", "."));
    if (!n || n <= 0) { setError("Enter a valid amount"); return; }
    setSaving(true);
    try {
      await onSave(n);
      onClose();
    } catch {
      setError("Could not save budget");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Budget · {monthLabel}</Text>
          <Text style={styles.modalSubtitle}>Spending limit for this month.</Text>
          {error ? <Text style={styles.modalError}>{error}</Text> : null}
          <TextInput
            style={styles.modalInput}
            keyboardType="decimal-pad"
            placeholder="1000"
            placeholderTextColor={C.t3}
            value={value}
            onChangeText={setValue}
            autoFocus
          />
          <View style={styles.modalButtons}>
            <PressableScale style={styles.modalCancel} onPress={onClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </PressableScale>
            <PressableScale style={styles.modalSave} onPress={save} disabled={saving}>
              <Text style={styles.modalSaveText}>{saving ? "Saving…" : "Save"}</Text>
            </PressableScale>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  welcome: { color: C.t2, fontSize: 14, fontWeight: '500' },
  userName: { color: C.t1, fontSize: 28, fontWeight: '800', letterSpacing: -0.6, marginTop: 2 },
  partnerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.accentFade,
    borderWidth: 1,
    borderColor: C.accentBorder,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  partnerDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: C.accent,
  },
  partnerChipText: { color: C.accent, fontSize: 12, fontWeight: '700' },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.card,
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  monthArrow: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  arrowText: { color: C.accent, fontSize: 24, fontWeight: '300' },
  monthCenter: { alignItems: 'center' },
  monthText: { color: C.t1, fontWeight: '600', fontSize: 16 },
  monthHint: { color: C.t3, fontSize: 11, marginTop: 2 },
  budgetMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: -8,
    marginBottom: 24,
  },
  plannedHint: { color: C.t3, fontSize: 13 },
  editBudget: { color: C.accent, fontSize: 13, fontWeight: '600' },
  sectionTitle: {
    color: C.t1,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: -0.3,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  seeAll: { color: C.accent, fontSize: 14, fontWeight: '600' },
  emptyCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  emptyText: { color: C.t3, fontSize: 14, lineHeight: 20 },
  forecastCard: {
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.border,
  },
  forecastHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  forecastMonth: { color: C.t1, fontWeight: '600', fontSize: 15 },
  forecastAmount: { color: C.gold, fontWeight: '700', fontSize: 15 },
  projectPills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  projectPill: {
    backgroundColor: C.elevated,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  projectPillText: { color: C.t2, fontSize: 13 },
  // Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 24,
  },
  modalCard: {
    backgroundColor: C.card,
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
    borderColor: C.border,
  },
  modalTitle: { color: C.t1, fontSize: 18, fontWeight: '700', marginBottom: 4 },
  modalSubtitle: { color: C.t2, fontSize: 14, marginBottom: 16 },
  modalError: { color: C.red, fontSize: 13, marginBottom: 10 },
  modalInput: {
    backgroundColor: C.elevated,
    color: C.t1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  modalButtons: { flexDirection: 'row', gap: 10 },
  modalCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: C.elevated,
  },
  modalCancelText: { color: C.t2, fontWeight: '600' },
  modalSave: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    backgroundColor: C.accent,
  },
  modalSaveText: { color: '#fff', fontWeight: '700' },
  // Balance widget
  balanceCard: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
  },
  balanceLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  balanceDot: { width: 8, height: 8, borderRadius: 4 },
  balanceLabel: { color: C.t2, fontSize: 13 },
  balanceAmount: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  balanceSquared: {
    backgroundColor: C.accentFade,
    borderColor: C.accentBorder,
  },
  balanceSquaredText: { color: C.accent, fontSize: 14, fontWeight: '600' },
});
