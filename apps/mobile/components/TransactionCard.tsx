import { View, Text, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import Animated, { FadeInDown } from "react-native-reanimated";
import type { Expense } from "../lib/types";
import { CATEGORY_META, formatMoney, formatShortDate } from "../lib/display";
import PressableScale from "./ui/PressableScale";
import { C } from "../lib/theme";

interface Props {
  expense: Expense;
  onDelete?: (id: string) => void;
  index?: number;
}

export default function TransactionCard({ expense, onDelete, index = 0 }: Props) {
  const meta = CATEGORY_META[expense.category] ?? CATEGORY_META.OTHER;
  const isPlanned = expense.status === "PLANNED";
  const title = expense.title || meta.label;

  return (
    <Animated.View entering={index < 8 ? FadeInDown.delay(index * 55).duration(380) : undefined}>
      <View style={styles.card}>
        <View style={styles.iconWrapper}>
          <View style={[styles.iconCircle, { backgroundColor: meta.hex + '22' }]}>
            <Text style={styles.icon}>{meta.icon}</Text>
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <View style={styles.meta}>
            <Text style={styles.date}>{formatShortDate(expense.date)}</Text>
            {expense.event ? (
              <Text style={styles.event} numberOfLines={1}>
                {" · "}{expense.event.title}
              </Text>
            ) : null}
            {isPlanned ? (
              <View style={styles.plannedBadge}>
                <Text style={styles.plannedText}>PLANNED</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.right}>
          <Text style={[styles.amount, isPlanned ? styles.amountPlanned : styles.amountPaid]}>
            {isPlanned ? "~" : "−"}{formatMoney(expense.amount)}
          </Text>
          {onDelete ? (
            <PressableScale
              onPress={() => onDelete(expense.id)}
              hitSlop={10}
              style={styles.deleteBtn}
            >
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path d="M3 6H21M8 6V4H16V6M19 6L18 20H6L5 6" stroke={C.t3} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
            </PressableScale>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.borderStrong,
  },
  iconWrapper: { marginRight: 12 },
  iconCircle: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 20 },
  content: { flex: 1, marginRight: 8 },
  title: { color: C.t1, fontWeight: '600', fontSize: 15, marginBottom: 4 },
  meta: { flexDirection: 'row', alignItems: 'center' },
  date: { color: C.t2, fontSize: 13 },
  event: { color: C.t3, fontSize: 13, flex: 1 },
  plannedBadge: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 6,
  },
  plannedText: { color: C.gold, fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  right: { alignItems: 'flex-end' },
  amount: { fontSize: 15, fontWeight: '700' },
  amountPaid: { color: C.t1 },
  amountPlanned: { color: C.gold },
  deleteBtn: { marginTop: 6 },
});
