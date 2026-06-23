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
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import {
  useFinanceStore,
  summarizeMonth,
} from "../../../store/useFinanceStore";
import { useAuthStore } from "../../../store/useAuthStore";
import { usePartnerStore } from "../../../store/usePartnerStore";
import TransactionCard from "../../../components/TransactionCard";
import PressableScale from "../../../components/ui/PressableScale";
import { AnimatedProgress, AnimatedBar } from "../../../components/ui/AnimatedProgress";
import {
  EVENT_TYPE_META,
  CATEGORY_META,
  CATEGORY_ORDER,
  formatMoney,
  monthLong,
  shiftMonth,
  currentMonthKey,
  monthKeyFromIso,
} from "../../../lib/display";
import type { ForecastMonth } from "../../../lib/types";
import type { Palette } from "../../../lib/theme";
import { useC } from "../../../lib/useTheme";
import { useT } from "../../../lib/i18n";
import { useLanguageStore } from "../../../store/useLanguageStore";

const LANG_LOCALE: Record<string, string> = { en: "en-US", ru: "ru-RU", uk: "uk-UA", de: "de-DE" };

const DEFAULT_BUDGET = 1000;

export default function Dashboard() {
  const router = useRouter();
  const C = useC();
  const T = useT();
  const s = useMemo(() => makeStyles(C), [C]);

  const { forecast, expenses, budgets, refresh, setBudget } = useFinanceStore();
  const user = useAuthStore((st) => st.user);
  const { couple, split, fetchPartner, fetchSplit } = usePartnerStore();
  const { language } = useLanguageStore();
  const locale = LANG_LOCALE[language] ?? "en-US";

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
  const budget = budgets[selectedMonth] ?? defaultBudget;
  const summary = useMemo(() => summarizeMonth(expenses, selectedMonth), [expenses, selectedMonth]);
  const ratio = budget > 0 ? summary.paid / budget : 0;
  const left = Math.max(0, budget - summary.paid);
  const isCurrent = selectedMonth === currentMonthKey();

  const monthExpenses = useMemo(
    () => expenses.filter((e) => monthKeyFromIso(e.date) === selectedMonth).slice(0, 5),
    [expenses, selectedMonth]
  );

  // Last 7 days of PAID spend, for the activity chart.
  const weekly = useMemo(() => {
    const now = new Date();
    const days: { key: string; label: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      days.push({
        key: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString(locale, { weekday: "narrow" }),
      });
    }
    const sums = days.map((d) =>
      expenses
        .filter((e) => e.status === "PAID" && e.date.slice(0, 10) === d.key)
        .reduce((acc, e) => acc + e.amount, 0)
    );
    const max = Math.max(1, ...sums);
    return days.map((d, i) => ({ ...d, value: sums[i], ratio: sums[i] / max, today: i === 6 }));
  }, [expenses, locale]);

  // Top spending categories for the selected month.
  const categories = useMemo(() => {
    const total = summary.paid || 1;
    return CATEGORY_ORDER
      .filter((c) => (summary.byCategory[c] ?? 0) > 0)
      .map((c) => ({ c, amount: summary.byCategory[c] ?? 0, pct: (summary.byCategory[c] ?? 0) / total }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);
  }, [summary]);

  const onRefresh = async () => {
    setRefreshing(true);
    try { await refresh(); } finally { setRefreshing(false); }
  };

  const initials = (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "");

  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
    >
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(420)} style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.welcome}>{T.dashboard.welcomeBack}</Text>
          <Text style={s.userName} numberOfLines={1}>{user?.firstName ?? "Dancer"}</Text>
          {couple ? (
            <View style={s.syncChip}>
              <View style={s.syncDot} />
              <Text style={s.syncChipText}>{T.dashboard.syncedWith} {couple.partner.firstName}</Text>
            </View>
          ) : null}
        </View>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initials || "?"}</Text>
        </View>
      </Animated.View>

      {/* Month selector */}
      <Animated.View entering={FadeInDown.delay(50).duration(420)} style={s.monthRow}>
        <PressableScale onPress={() => setSelectedMonth((m) => shiftMonth(m, -1))} style={s.monthArrow}>
          <Text style={s.arrowText}>‹</Text>
        </PressableScale>
        <PressableScale onPress={() => setSelectedMonth(currentMonthKey())} style={s.monthCenter}>
          <Text style={s.monthText}>{monthLong(selectedMonth)}</Text>
          {!isCurrent && <Text style={s.monthHint}>{T.dashboard.tapForCurrent}</Text>}
        </PressableScale>
        <PressableScale onPress={() => setSelectedMonth((m) => shiftMonth(m, 1))} style={s.monthArrow}>
          <Text style={s.arrowText}>›</Text>
        </PressableScale>
      </Animated.View>

      {/* Hero — spend vs budget */}
      <Animated.View entering={FadeInDown.delay(100).duration(450)}>
        <LinearGradient
          colors={["#6366F1", "#8B5CF6", "#A855F7"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          <View style={s.heroTopRow}>
            <Text style={s.heroLabel}>{T.dashboard.spentIn} {monthLong(selectedMonth).split(" ")[0]}</Text>
            <PressableScale onPress={() => setBudgetModal(true)} style={s.heroBudgetBtn}>
              <Text style={s.heroBudgetBtnText}>{T.dashboard.editBudget}</Text>
            </PressableScale>
          </View>
          <Text style={s.heroBig}>{formatMoney(summary.paid)}</Text>
          <Text style={s.heroOf}>
            {T.dashboard.ofBudget} {formatMoney(budget)} {T.dashboard.budget.toLowerCase()}
            {summary.planned > 0 ? `  ·  +${formatMoney(summary.planned)} ${T.finance.planned.toLowerCase()}` : ""}
          </Text>
          <View style={{ marginTop: 16 }}>
            <AnimatedProgress
              progress={ratio}
              track="rgba(255,255,255,0.25)"
              fill="#FFFFFF"
              height={8}
              delay={250}
            />
          </View>
          <Text style={s.heroLeft}>{formatMoney(left)} {T.dashboard.leftThisMonth}</Text>
        </LinearGradient>
      </Animated.View>

      {/* Partner balance */}
      {couple && split ? (
        <Animated.View entering={FadeInDown.delay(150).duration(420)}>
          <BalanceCard split={split} partnerName={couple.partner.firstName} />
        </Animated.View>
      ) : null}

      {/* Stat chips */}
      <Animated.View entering={FadeInDown.delay(180).duration(420)} style={s.statsRow}>
        <StatChip label={T.budget.spent} value={formatMoney(summary.paid)} tint={C.accent} icon="wallet" />
        <StatChip label={T.finance.planned} value={formatMoney(summary.planned)} tint={C.gold} icon="clock" />
        <StatChip label={T.budget.left} value={formatMoney(left)} tint="#10B981" icon="leaf" />
      </Animated.View>

      {/* Weekly spend chart */}
      <Animated.View entering={FadeInDown.delay(220).duration(420)}>
        <View style={s.card}>
          <View style={s.cardHeadRow}>
            <Text style={s.cardTitle}>{T.dashboard.weeklySpend}</Text>
            <Text style={s.cardHint}>{T.dashboard.lastDays}</Text>
          </View>
          <View style={s.chartRow}>
            {weekly.map((d, i) => (
              <View key={d.key} style={s.chartCol}>
                <View style={s.chartBarWrap}>
                  <AnimatedBar
                    ratio={d.ratio}
                    color={d.today ? C.accent : C.accentFade}
                    maxHeight={84}
                    width="70%"
                    delay={300 + i * 55}
                  />
                </View>
                <Text style={[s.chartLabel, d.today && { color: C.accent, fontWeight: "700" }]}>{d.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </Animated.View>

      {/* Upcoming forecast */}
      <Animated.View entering={FadeInDown.delay(260).duration(420)}>
        <Text style={s.sectionTitle}>{T.dashboard.upcoming}</Text>
        {forecast.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>{T.dashboard.noUpcoming}</Text>
          </View>
        ) : (
          forecast.slice(0, 3).map((m, i) => (
            <ForecastCard key={m.month} month={m} index={i} onPressProject={(id) => router.push(`/project/${id}`)} />
          ))
        )}
      </Animated.View>

      {/* Category breakdown */}
      {categories.length > 0 ? (
        <Animated.View entering={FadeInDown.delay(300).duration(420)}>
          <Text style={s.sectionTitle}>{T.dashboard.spendingByCategory}</Text>
          <View style={s.card}>
            {categories.map((row, i) => {
              const meta = CATEGORY_META[row.c];
              return (
                <View key={row.c} style={[s.catRow, i === categories.length - 1 && { marginBottom: 0 }]}>
                  <View style={[s.catIcon, { backgroundColor: meta.hex + "1F" }]}>
                    <Text style={{ fontSize: 16 }}>{meta.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={s.catLine}>
                      <Text style={s.catName}>{meta.label}</Text>
                      <Text style={s.catAmt}>
                        {formatMoney(row.amount)} <Text style={s.catPct}>{Math.round(row.pct * 100)}%</Text>
                      </Text>
                    </View>
                    <AnimatedProgress
                      progress={row.pct}
                      track={C.elevated}
                      fill={meta.hex}
                      height={6}
                      delay={350 + i * 70}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </Animated.View>
      ) : null}

      {/* Recent expenses */}
      <Animated.View entering={FadeInDown.delay(340).duration(420)}>
        <View style={s.sectionRow}>
          <Text style={s.sectionTitle}>{T.dashboard.expensesHeader}</Text>
          <PressableScale onPress={() => router.push("/expenses")}>
            <Text style={s.seeAll}>{T.dashboard.seeAll}</Text>
          </PressableScale>
        </View>
        {monthExpenses.length === 0 ? (
          <Text style={s.emptyText}>{T.dashboard.noExpensesIn} {monthLong(selectedMonth)}.</Text>
        ) : (
          monthExpenses.map((tx, i) => <TransactionCard key={tx.id} expense={tx} index={i} />)
        )}
      </Animated.View>

      <View style={{ height: 28 }} />

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

// ─── Stat chip ────────────────────────────────────────────────────────────────
function StatChip({ label, value, tint, icon }: { label: string; value: string; tint: string; icon: string }) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  const dots = icon === "wallet" ? [0.5, 0.3, 0.8, 0.6, 0.95] : icon === "clock" ? [0.3, 0.55, 0.45, 0.7, 0.6] : [0.4, 0.7, 0.55, 0.9, 0.75];
  return (
    <View style={s.statChip}>
      <View style={[s.statDot, { backgroundColor: tint + "22" }]}>
        <View style={[s.statDotInner, { backgroundColor: tint }]} />
      </View>
      <Text style={s.statValue} numberOfLines={1}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
      <View style={s.spark}>
        {dots.map((h, i) => (
          <View key={i} style={{ width: 3, height: 16 * h, borderRadius: 2, backgroundColor: tint, opacity: 0.5 }} />
        ))}
      </View>
    </View>
  );
}

// ─── Partner balance ────────────────────────────────────────────────────────
function BalanceCard({ split, partnerName }: { split: { balance: number }; partnerName: string }) {
  const C = useC();
  const T = useT();
  const s = useMemo(() => makeStyles(C), [C]);
  const { balance } = split;
  const abs = Math.abs(balance);

  if (abs < 0.01) {
    return (
      <View style={[s.balanceCard, { backgroundColor: C.accentFade, borderColor: C.accentBorder }]}>
        <Text style={[s.balanceSquared, { color: C.accent }]}>{T.partner.you} & {partnerName} — {T.partner.balanced} ✓</Text>
      </View>
    );
  }
  const positive = balance > 0;
  const color = positive ? C.accent : C.gold;
  const label = positive ? `${partnerName} ${T.partner.theyOwe}` : `${T.partner.youOwe} ${partnerName}`;
  return (
    <View style={[s.balanceCard, { backgroundColor: positive ? C.accentFade : C.goldFade, borderColor: positive ? C.accentBorder : C.goldBorder }]}>
      <View style={s.balanceLeft}>
        <View style={[s.balanceDot, { backgroundColor: color }]} />
        <Text style={s.balanceLabel}>{label}</Text>
      </View>
      <Text style={[s.balanceAmount, { color }]}>{formatMoney(abs)}</Text>
    </View>
  );
}

// ─── Forecast card ──────────────────────────────────────────────────────────
function ForecastCard({ month, onPressProject, index = 0 }: { month: ForecastMonth; onPressProject: (id: string) => void; index?: number }) {
  const C = useC();
  const T = useT();
  const s = useMemo(() => makeStyles(C), [C]);
  return (
    <View style={s.forecastCard}>
      <View style={s.forecastHeader}>
        <Text style={s.forecastMonth}>{month.label}</Text>
        <Text style={s.forecastAmount}>~{formatMoney(month.expected)}</Text>
      </View>
      {month.projects.length > 0 ? (
        <View style={s.projectPills}>
          {month.projects.map((p) => (
            <PressableScale key={p.id} onPress={() => onPressProject(p.id)} style={s.projectPill}>
              <Text style={s.projectPillText}>{EVENT_TYPE_META[p.type]?.icon} {p.title}</Text>
            </PressableScale>
          ))}
        </View>
      ) : (
        <Text style={{ color: C.t3, fontSize: 13 }}>{T.finance.planned}</Text>
      )}
    </View>
  );
}

// ─── Budget modal ─────────────────────────────────────────────────────────────
function BudgetModal({
  visible, current, monthLabel, onClose, onSave,
}: {
  visible: boolean;
  current: number;
  monthLabel: string;
  onClose: () => void;
  onSave: (value: number) => Promise<void>;
}) {
  const C = useC();
  const T = useT();
  const s = useMemo(() => makeStyles(C), [C]);
  const [value, setValue] = useState(String(current));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) { setValue(String(current)); setError(null); }
  }, [visible, current]);

  const save = async () => {
    const n = Number(value.replace(",", "."));
    if (!n || n <= 0) { setError(T.budget.errorInvalid); return; }
    setSaving(true);
    try { await onSave(n); onClose(); }
    catch { setError(T.budget.errorSave); }
    finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.modalCard}>
          <Text style={s.modalTitle}>{T.budget.modalTitle} · {monthLabel}</Text>
          <Text style={s.modalSubtitle}>{T.budget.modalSub}</Text>
          {error ? <Text style={s.modalError}>{error}</Text> : null}
          <TextInput
            style={s.modalInput}
            keyboardType="decimal-pad"
            placeholder="1000"
            placeholderTextColor={C.t3}
            value={value}
            onChangeText={setValue}
            autoFocus
          />
          <View style={s.modalButtons}>
            <PressableScale style={s.modalCancel} onPress={onClose}>
              <Text style={s.modalCancelText}>{T.common.cancel}</Text>
            </PressableScale>
            <PressableScale style={s.modalSave} onPress={save} disabled={saving}>
              <Text style={s.modalSaveText}>{saving ? T.common.loading : T.common.save}</Text>
            </PressableScale>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },

    header: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
    welcome: { color: C.t3, fontSize: 12, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase" },
    userName: { color: C.t1, fontSize: 28, fontWeight: "900", letterSpacing: -0.7, marginTop: 3 },
    syncChip: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: 8, backgroundColor: "rgba(16,185,129,0.12)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
    syncDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#10B981" },
    syncChipText: { color: "#0c7a59", fontSize: 11, fontWeight: "700" },
    avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.accentFade, borderWidth: 1.5, borderColor: C.accentBorder, alignItems: "center", justifyContent: "center" },
    avatarText: { color: C.accent, fontSize: 15, fontWeight: "800" },

    monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: C.card, borderRadius: 18, paddingHorizontal: 8, paddingVertical: 7, marginBottom: 16, borderWidth: 1, borderColor: C.border },
    monthArrow: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 10 },
    arrowText: { color: C.accent, fontSize: 24, fontWeight: "300" },
    monthCenter: { alignItems: "center" },
    monthText: { color: C.t1, fontWeight: "700", fontSize: 16 },
    monthHint: { color: C.t3, fontSize: 11, marginTop: 2 },

    hero: { borderRadius: 24, padding: 20, shadowColor: "#6366F1", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8 },
    heroTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    heroLabel: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "600" },
    heroBudgetBtn: { backgroundColor: "rgba(255,255,255,0.18)", borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
    heroBudgetBtnText: { color: "#fff", fontSize: 11, fontWeight: "700" },
    heroBig: { color: "#fff", fontSize: 38, fontWeight: "900", letterSpacing: -1.2, marginTop: 8 },
    heroOf: { color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 2 },
    heroLeft: { color: "rgba(255,255,255,0.92)", fontSize: 12, fontWeight: "600", marginTop: 10 },

    statsRow: { flexDirection: "row", gap: 10, marginTop: 16 },
    statChip: { flex: 1, backgroundColor: C.card, borderRadius: 18, padding: 13, borderWidth: 1, borderColor: C.border },
    statDot: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center", marginBottom: 10 },
    statDotInner: { width: 12, height: 12, borderRadius: 4 },
    statValue: { color: C.t1, fontSize: 17, fontWeight: "800", letterSpacing: -0.4 },
    statLabel: { color: C.t3, fontSize: 11, fontWeight: "600", marginTop: 1 },
    spark: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 16, marginTop: 8 },

    card: { backgroundColor: C.card, borderRadius: 22, padding: 16, marginTop: 16, borderWidth: 1, borderColor: C.border },
    cardHeadRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
    cardTitle: { color: C.t1, fontSize: 15, fontWeight: "800" },
    cardHint: { color: C.t3, fontSize: 12 },

    chartRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 104 },
    chartCol: { flex: 1, alignItems: "center", gap: 8 },
    chartBarWrap: { flex: 1, width: "100%", alignItems: "center", justifyContent: "flex-end" },
    chartLabel: { color: C.t3, fontSize: 11, fontWeight: "600" },

    sectionTitle: { color: C.t1, fontSize: 19, fontWeight: "800", letterSpacing: -0.4, marginTop: 24, marginBottom: 12 },
    sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 24, marginBottom: 12 },
    seeAll: { color: C.accent, fontSize: 14, fontWeight: "700" },

    emptyCard: { backgroundColor: C.card, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: C.border },
    emptyText: { color: C.t3, fontSize: 14, lineHeight: 20 },

    forecastCard: { backgroundColor: C.card, borderRadius: 18, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: C.border },
    forecastHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
    forecastMonth: { color: C.t1, fontWeight: "700", fontSize: 15 },
    forecastAmount: { color: C.gold, fontWeight: "800", fontSize: 15 },
    projectPills: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    projectPill: { backgroundColor: C.elevated, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: C.border },
    projectPillText: { color: C.t2, fontSize: 13 },

    catRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
    catIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    catLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginBottom: 7 },
    catName: { color: C.t1, fontSize: 14, fontWeight: "600" },
    catAmt: { color: C.t1, fontSize: 14, fontWeight: "700" },
    catPct: { color: C.t3, fontSize: 11, fontWeight: "600" },

    balanceCard: { borderRadius: 18, padding: 15, marginTop: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1 },
    balanceLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
    balanceDot: { width: 8, height: 8, borderRadius: 4 },
    balanceLabel: { color: C.t2, fontSize: 13, fontWeight: "500" },
    balanceAmount: { fontSize: 17, fontWeight: "800", letterSpacing: -0.3 },
    balanceSquared: { fontSize: 14, fontWeight: "700" },

    modalOverlay: { flex: 1, justifyContent: "center", backgroundColor: "rgba(5,5,12,0.6)", paddingHorizontal: 24 },
    modalCard: { backgroundColor: C.card, borderRadius: 24, padding: 22, borderWidth: 1, borderColor: C.borderStrong },
    modalTitle: { color: C.t1, fontSize: 18, fontWeight: "700", marginBottom: 4 },
    modalSubtitle: { color: C.t2, fontSize: 14, marginBottom: 16 },
    modalError: { color: C.red, fontSize: 13, marginBottom: 10 },
    modalInput: { backgroundColor: C.input, color: C.t1, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 18, fontWeight: "600", marginBottom: 16, borderWidth: 1, borderColor: C.border },
    modalButtons: { flexDirection: "row", gap: 10 },
    modalCancel: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: "center", backgroundColor: C.elevated },
    modalCancelText: { color: C.t2, fontWeight: "600" },
    modalSave: { flex: 1, paddingVertical: 14, borderRadius: 14, alignItems: "center", backgroundColor: C.accent },
    modalSaveText: { color: "#fff", fontWeight: "700" },
  });
}
