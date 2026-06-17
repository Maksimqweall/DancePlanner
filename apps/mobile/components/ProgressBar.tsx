import { View, Text } from "react-native";
import { formatMoney } from "../lib/display";

interface ProgressBarProps {
  spent: number;
  limit: number;
}

export default function ProgressBar({ spent, limit }: ProgressBarProps) {
  const percentage = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
  const isOverBudget = spent > limit;

  return (
    <View className="bg-zinc-800 p-5 rounded-3xl mb-6">
      <View className="flex-row justify-between mb-2">
        <Text className="text-zinc-400 font-medium">Monthly budget</Text>
        <Text className="text-white font-bold">
          {formatMoney(spent)} / {formatMoney(limit)}
        </Text>
      </View>

      <View className="h-3 bg-zinc-700 rounded-full overflow-hidden">
        <View
          className={`h-full rounded-full ${isOverBudget ? "bg-red-500" : "bg-emerald-500"}`}
          style={{ width: `${percentage}%` }}
        />
      </View>

      {isOverBudget ? (
        <Text className="text-red-400 text-xs mt-2 text-right">Limit exceeded!</Text>
      ) : null}
    </View>
  );
}
