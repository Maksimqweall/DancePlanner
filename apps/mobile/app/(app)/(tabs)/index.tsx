import { useCallback, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useFinanceStore } from "../../../store/useFinanceStore";
import { useAuthStore } from "../../../store/useAuthStore";
import ProgressBar from "../../../components/ProgressBar";
import TransactionCard from "../../../components/TransactionCard";
import { EVENT_TYPE_META, formatMoney } from "../../../lib/display";
import type { ForecastMonth } from "../../../lib/types";

function ForecastCard({ month, onPressProject }: {
  month: ForecastMonth;
  onPressProject: (id: string) => void;
}) {
  return (
    <View className="bg-zinc-800 rounded-2xl p-4 mb-3">
      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-white font-semibold text-base">{month.label}</Text>
        <Text className="text-amber-400 font-bold text-base">
          ~{formatMoney(month.expected)}
        </Text>
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

export default function Dashboard() {
  const router = useRouter();
  const { summary, forecast, expenses, monthlyLimit, refresh } = useFinanceStore();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const spent = summary?.total ?? 0;
  const recent = expenses.slice(0, 5);

  return (
    <ScrollView
      className="flex-1 bg-zinc-900 px-4 pt-4"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />
      }
    >
      <View className="flex-row justify-between items-center mb-6">
        <View>
          <Text className="text-zinc-400">Welcome back,</Text>
          <Text className="text-2xl text-white font-bold">{user?.firstName ?? "Dancer"}</Text>
        </View>
        <TouchableOpacity onPress={logout} className="bg-zinc-800 px-3 py-2 rounded-xl">
          <Text className="text-zinc-300">Log out</Text>
        </TouchableOpacity>
      </View>

      <ProgressBar spent={spent} limit={monthlyLimit} />

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

      <View className="flex-row justify-between items-center mb-3 mt-3">
        <Text className="text-xl text-white font-semibold">Recent expenses</Text>
        <TouchableOpacity onPress={() => router.push("/expenses")}>
          <Text className="text-emerald-400">See all</Text>
        </TouchableOpacity>
      </View>

      {recent.length === 0 ? (
        <Text className="text-zinc-500 text-center mt-6">
          No expenses yet. Add your first one in the Expenses tab.
        </Text>
      ) : (
        recent.map((tx) => <TransactionCard key={tx.id} expense={tx} />)
      )}

      <View className="h-10" />
    </ScrollView>
  );
}
