import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import type { MonthAggregate } from "../store/useFinanceStore";
import { monthShort, formatMoney } from "../lib/display";

interface Props {
  data: MonthAggregate[];
  selectedMonth: string;
  onSelect: (month: string) => void;
  budgetForMonth?: (month: string) => number;
}

const CHART_HEIGHT = 120;
const BAR_WIDTH = 30;
const COL_WIDTH = 46;

// Horizontal bar chart of monthly spend. Paid (solid) stacked with planned 
// A dashed budget marker is drawn per column. Tap a column to select that month.
export default function MonthlyBarChart({ data, selectedMonth, onSelect, budgetForMonth }: Props) {
  const budgets = budgetForMonth ? data.map((d) => budgetForMonth(d.month)) : [];
  const max = Math.max(
    1,
    ...data.map((d) => d.paid + d.planned),
    ...budgets
  );

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ alignItems: "flex-end", paddingHorizontal: 4 }}
      >
        {data.map((d) => {
          const total = d.paid + d.planned;
          const paidH = (d.paid / max) * CHART_HEIGHT;
          const plannedH = (d.planned / max) * CHART_HEIGHT;
          const selected = d.month === selectedMonth;
          const budget = budgetForMonth ? budgetForMonth(d.month) : undefined;
          const budgetH = budget ? (budget / max) * CHART_HEIGHT : undefined;
          const overBudget = budget != null && total > budget;
          return (
            <TouchableOpacity
              key={d.month}
              onPress={() => onSelect(d.month)}
              style={{ width: COL_WIDTH }}
              className="items-center"
            >
              {/* Value label */}
              <Text
                className={overBudget ? "text-red-400" : "text-zinc-400"}
                style={{ fontSize: 9, marginBottom: 2 }}
              >
                {total > 0 ? Math.round(total) : ""}
              </Text>
              {/* Bar track */}
              <View
                style={{ height: CHART_HEIGHT, width: BAR_WIDTH, justifyContent: "flex-end" }}
                className={`rounded-lg ${selected ? "bg-zinc-700/60" : ""}`}
              >
                <View
                  style={{ height: plannedH }}
                  className="bg-amber-400/80 rounded-t-md"
                />
                <View
                  style={{ height: paidH }}
                  className={`${plannedH > 0 ? "" : "rounded-t-md"} bg-emerald-500`}
                />
                {/* Budget marker */}
                {budgetH != null ? (
                  <View
                    style={{ position: "absolute", bottom: budgetH, left: -3, right: -3 }}
                    className="border-t-2 border-dashed border-zinc-300"
                  />
                ) : null}
              </View>
              {/* Month label */}
              <Text
                className={`mt-1 ${selected ? "text-white font-bold" : "text-zinc-500"}`}
                style={{ fontSize: 11 }}
              >
                {monthShort(d.month)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View className="flex-row justify-center mt-2">
        <Legend color="bg-emerald-500" label="Paid" />
        <Legend color="bg-amber-400/80" label="Planned" />
        <Legend color="bg-zinc-300" label="Budget" />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View className="flex-row items-center mx-2">
      <View className={`w-3 h-3 rounded-sm mr-1 ${color}`} />
      <Text className="text-zinc-400 text-xs">{label}</Text>
    </View>
  );
}
