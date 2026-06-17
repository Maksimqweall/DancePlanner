import { View, Text, TouchableOpacity } from "react-native";
import type { Expense } from "../lib/types";
import { CATEGORY_META, formatMoney, formatShortDate } from "../lib/display";

interface Props {
  expense: Expense;
  onDelete?: (id: string) => void;
}

export default function TransactionCard({ expense, onDelete }: Props) {
  const meta = CATEGORY_META[expense.category] ?? CATEGORY_META.OTHER;
  const isPlanned = expense.status === "PLANNED";
  const title = expense.title || meta.label;

  return (
    <View className="flex-row items-center justify-between p-4 mb-3 bg-zinc-800 rounded-2xl">
      <View className="flex-row items-center flex-1">
        <View className={`w-12 h-12 rounded-full items-center justify-center ${meta.color}`}>
          <Text className="text-xl">{meta.icon}</Text>
        </View>

        <View className="ml-4 flex-1">
          <Text className="text-white font-semibold text-base" numberOfLines={1}>
            {title}
          </Text>
          <View className="flex-row items-center">
            <Text className="text-zinc-400 text-sm">{formatShortDate(expense.date)}</Text>
            {expense.event ? (
              <Text className="text-zinc-500 text-sm" numberOfLines={1}>
                {"  ·  "}
                {expense.event.title}
              </Text>
            ) : null}
            {isPlanned ? (
              <Text className="text-amber-400 text-xs ml-2 font-semibold">PLANNED</Text>
            ) : null}
          </View>
        </View>
      </View>

      <View className="items-end ml-2">
        <Text className={`font-bold text-base ${isPlanned ? "text-amber-400" : "text-white"}`}>
          {isPlanned ? "" : "-"}
          {formatMoney(expense.amount)}
        </Text>
        {onDelete ? (
          <TouchableOpacity onPress={() => onDelete(expense.id)} hitSlop={8}>
            <Text className="text-zinc-500 text-xs mt-1">Delete</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}
