import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Modal,
  TextInput,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import {
  useFinanceStore,
  summarizeMonth,
  monthlySeries,
} from "../../../store/useFinanceStore";
import { useAuthStore } from "../../../store/useAuthStore";
import ProgressBar from "../../../components/ProgressBar";
import TransactionCard from "../../../components/TransactionCard";
import MonthlyBarChart from "../../../components/MonthlyBarChart";
import {
  EVENT_TYPE_META,
  formatMoney,
  monthLong,
  shiftMonth,
  currentMonthKey,
  monthKeyFromIso,
} from "../../../lib/display";
import type { ForecastMonth } from "../../../lib/types";

const DEFAULT_BUDGET = 1000;

export default function Dashboard() {
  const router = useRouter();
  const { forecast, expenses, budgets, refresh, setBudget } = useFinanceStore();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey());
  const [refreshing, setRefreshing] = useState(false);
  const [budgetModal, setBudgetModal] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const defaultBudget = user?.monthlyBudget ?? DEFAULT_BUDGET;
  const budgetForMonth = useCallback(
    (m: string) => budgets[m] ?? defaultBudget,
    [budgets, defaultBudget]
  );
  const budget = budgetForMonth(selectedMonth);
  const series = useMemo(() => monthlySeries(expenses, currentMonthKey()), [expenses]);
  const summary = useMemo(() => summarizeMonth(expenses, selectedMonth), [expenses, selectedMonth]);
  const monthExpenses = useMemo(
    () => expenses.filter((e) => monthKeyFromIso(e.date) === selectedMonth).slice(0, 6),
    [expenses, selectedMonth]
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const isCurrent = selectedMonth === currentMonthKey();

  return (
    <ScrollView
      className="flex-1 bg-zinc-900 px-4 pt-4"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />
      }
    >
      <View className="flex-row justify-between items-center mb-5">
        <View>
          <Text className="text-zinc-400">Welcome back,</Text>
          <Text className="text-2xl text-white font-bold">{user?.firstName ?? "Dancer"}</Text>
        </View>
        <TouchableOpacity onPress={logout} className="bg-zinc-800 px-3 py-2 rounded-xl">
          <Text className="text-zinc-300">Log out</Text>
        </TouchableOpacity>
      </View>

      {/* Month selector */}
      <View className="flex-row items-center justify-between bg-zinc-800 rounded-2xl px-2 py-2 mb-4">
        <TouchableOpacity
          onPress={() => setSelectedMonth((m) => shiftMonth(m, -1))}
          className="w-10 h-10 items-center justify-center"
        >
          <Text className="text-emerald-400 text-2xl">‹</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setSelectedMonth(currentMonthKey())}>
          <Text className="text-white font-semibold text-base">{monthLong(selectedMonth)}</Text>
          {!isCurrent ? (
            <Text className="text-zinc-500 text-xs text-center">tap for current</Text>
          ) : null}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setSelectedMonth((m) => shiftMonth(m, 1))}
          className="w-10 h-10 items-center justify-center"
        >
          <Text className="text-emerald-400 text-2xl">›</Text>
        </TouchableOpacity>
      </View>

      {/* Budget for the selected month */}
      <ProgressBar spent={summary.paid} limit={budget} />
      <View className="flex-row justify-between items-center -mt-3 mb-6">
        <Text className="text-zinc-400 text-sm">
          {summary.planned > 0 ? `+ ${formatMoney(summary.planned)} planned this month` : " "}
        </Text>
        <TouchableOpacity onPress={() => setBudgetModal(true)}>
          <Text className="text-emerald-400 text-sm">Edit budget</Text>
        </TouchableOpacity>
      </View>

      {/* Monthly spending chart */}
      <Text className="text-xl text-white font-semibold mb-3">Monthly spending</Text>
      <View className="bg-zinc-800 rounded-2xl p-3 mb-6">
        <MonthlyBarChart
          data={series}
          selectedMonth={selectedMonth}
          onSelect={setSelectedMonth}
          budgetForMonth={budgetForMonth}
        />
      </View>

      {/* Upcoming forecast */}
      <Text className="text-xl text-white font-semibold mb-3">Upcoming forecast</Text>
      {forecast.length === 0 ? (
        <View className="bg-zinc-800 rounded-2xl p-4 mb-6">
          <Text className="text-zinc-500">
            No upcoming planned spend. Create a tournament or camp project to forecast costs.
          </Text>
        </View>
      ) : (
        <View className="mb-3">
          {forecast.map((m) => (
            <ForecastCard
              key={m.month}
              month={m}
              onPressProject={(id) => router.push(`/project/${id}`)}
            />
          ))}
        </View>
      )}

      {/* Expenses for the selected month */}
      <View className="flex-row justify-between items-center mb-3 mt-3">
        <Text className="text-xl text-white font-semibold">Expenses</Text>
        <TouchableOpacity onPress={() => router.push("/expenses")}>
          <Text className="text-emerald-400">See all</Text>
        </TouchableOpacity>
      </View>

      {monthExpenses.length === 0 ? (
        <Text className="text-zinc-500 text-center mt-6">No expenses in {monthLong(selectedMonth)}.</Text>
      ) : (
        monthExpenses.map((tx) => <TransactionCard key={tx.id} expense={tx} />)
      )}

      <View className="h-10" />

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

function ForecastCard({
  month,
  onPressProject,
}: {
  month: ForecastMonth;
  onPressProject: (id: string) => void;
}) {
  return (
    <View className="bg-zinc-800 rounded-2xl p-4 mb-3">
      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-white font-semibold text-base">{month.label}</Text>
        <Text className="text-amber-400 font-bold text-base">~{formatMoney(month.expected)}</Text>
      </View>
      {month.projects.length > 0 ? (
        <View className="flex-row flex-wrap">
          {month.projects.map((p) => (
            <TouchableOpacity
              key={p.id}
              onPress={() => onPressProject(p.id)}
              className="bg-zinc-700 rounded-full px-3 py-1 mr-2 mb-1"
            >
              <Text className="text-zinc-200 text-sm">
                {EVENT_TYPE_META[p.type]?.icon} {p.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <Text className="text-zinc-500 text-sm">Planned expenses</Text>
      )}
    </View>
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
    if (!n || n <= 0) {
      setError("Enter a valid amount");
      return;
    }
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
      <View className="flex-1 justify-center bg-black/60 px-6">
        <View className="bg-zinc-900 rounded-3xl p-5">
          <Text className="text-xl text-white font-bold mb-1">Budget · {monthLabel}</Text>
          <Text className="text-zinc-500 mb-4">Spending limit for this month.</Text>
          {error ? <Text className="text-red-400 mb-2">{error}</Text> : null}
          <TextInput
            className="bg-zinc-800 text-white rounded-xl px-4 py-3 mb-4 text-lg"
            keyboardType="decimal-pad"
            placeholder="1000"
            placeholderTextColor="#71717a"
            value={value}
            onChangeText={setValue}
            autoFocus
          />
          <View className="flex-row">
            <TouchableOpacity
              className="flex-1 py-3 rounded-xl items-center bg-zinc-800 mr-2"
              onPress={onClose}
            >
              <Text className="text-zinc-300 font-semibold">Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 py-3 rounded-xl items-center bg-emerald-500"
              onPress={save}
              disabled={saving}
            >
              <Text className="text-white font-bold">{saving ? "Saving…" : "Save"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
