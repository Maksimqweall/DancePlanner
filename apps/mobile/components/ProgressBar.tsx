import { useEffect } from "react";
import { View, Text, StyleSheet, useWindowDimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { formatMoney } from "../lib/display";
import { C } from "../lib/theme";

interface Props {
  spent: number;
  limit: number;
}

export default function ProgressBar({ spent, limit }: Props) {
  const { width } = useWindowDimensions();
  const barMaxWidth = width - 48 - 40; // screen - (24px * 2 horizontal padding) - card padding
  const percentage = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
  const isOver = spent > limit;

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withSpring(percentage / 100, {
      damping: 22,
      stiffness: 90,
      mass: 0.8,
    });
  }, [percentage]);

  const fillStyle = useAnimatedStyle(() => ({
    width: progress.value * barMaxWidth,
  }));

  const pctText = limit > 0 ? `${Math.round(percentage)}%` : "—";

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.cardLabel}>Monthly budget</Text>
        <Text style={styles.pct}>{pctText}</Text>
      </View>

      <View style={styles.amounts}>
        <Text style={styles.spent}>{formatMoney(spent)}</Text>
        <Text style={styles.limit}>/ {formatMoney(limit)}</Text>
      </View>

      <View style={[styles.track, { width: barMaxWidth }]}>
        <Animated.View
          style={[
            styles.fill,
            fillStyle,
            { backgroundColor: isOver ? C.red : C.accent },
          ]}
        />
      </View>

      {isOver && (
        <Text style={styles.overLabel}>
          Over by {formatMoney(spent - limit)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardLabel: {
    color: C.t2,
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  pct: {
    color: C.t1,
    fontSize: 13,
    fontWeight: '700',
  },
  amounts: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 14,
    gap: 6,
  },
  spent: {
    color: C.t1,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  limit: {
    color: C.t2,
    fontSize: 16,
    fontWeight: '500',
  },
  track: {
    height: 6,
    backgroundColor: C.elevated,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  overLabel: {
    color: C.red,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'right',
  },
});
