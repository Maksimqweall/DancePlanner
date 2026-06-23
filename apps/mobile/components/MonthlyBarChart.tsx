import { View, Text, ScrollView, TouchableOpacity } from "react-native";
import type { MonthAggregate } from "../store/useFinanceStore";
import { monthShort } from "../lib/display";
import { useC } from "../lib/useTheme";

interface Props {
  data: MonthAggregate[];
  selectedMonth: string;
  onSelect: (month: string) => void;
  budgetForMonth?: (month: string) => number;
}

const CHART_HEIGHT = 120;
const BAR_WIDTH = 30;
const COL_WIDTH = 46;

// Horizontal bar chart of monthly spend. Paid (accent) stacked with planned (gold).
// A dashed budget marker is drawn per column. Tap a column to select that month.
export default function MonthlyBarChart({ data, selectedMonth, onSelect, budgetForMonth }: Props) {
  const C = useC();
  const budgets = budgetForMonth ? data.map((d) => budgetForMonth(d.month)) : [];
  const max = Math.max(1, ...data.map((d) => d.paid + d.planned), ...budgets);

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
              style={{ width: COL_WIDTH, alignItems: "center" }}
            >
              <Text style={{ fontSize: 9, marginBottom: 2, color: overBudget ? C.red : C.t3 }}>
                {total > 0 ? Math.round(total) : ""}
              </Text>
              <View
                style={{
                  height: CHART_HEIGHT,
                  width: BAR_WIDTH,
                  justifyContent: "flex-end",
                  borderRadius: 10,
                  backgroundColor: selected ? C.elevated : "transparent",
                  overflow: "hidden",
                }}
              >
                <View style={{ height: plannedH, backgroundColor: C.gold, borderTopLeftRadius: 6, borderTopRightRadius: 6 }} />
                <View style={{ height: paidH, backgroundColor: C.accent, borderTopLeftRadius: plannedH > 0 ? 0 : 6, borderTopRightRadius: plannedH > 0 ? 0 : 6 }} />
                {budgetH != null ? (
                  <View
                    style={{
                      position: "absolute",
                      bottom: budgetH,
                      left: -3,
                      right: -3,
                      borderTopWidth: 2,
                      borderColor: C.t3,
                      borderStyle: "dashed",
                    }}
                  />
                ) : null}
              </View>
              <Text style={{ fontSize: 11, marginTop: 4, color: selected ? C.t1 : C.t3, fontWeight: selected ? "700" : "400" }}>
                {monthShort(d.month)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 8 }}>
        <Legend color={C.accent} label="Paid" />
        <Legend color={C.gold} label="Planned" />
        <Legend color={C.t3} label="Budget" />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const C = useC();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginHorizontal: 8 }}>
      <View style={{ width: 12, height: 12, borderRadius: 3, marginRight: 4, backgroundColor: color }} />
      <Text style={{ color: C.t2, fontSize: 12 }}>{label}</Text>
    </View>
  );
}
