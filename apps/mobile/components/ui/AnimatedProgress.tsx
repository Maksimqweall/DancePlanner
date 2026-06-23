import { useEffect } from "react";
import { View, type DimensionValue } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";

const EASE = Easing.out(Easing.cubic);

// A horizontal progress bar whose fill animates in from 0 on mount / value change.
export function AnimatedProgress({
  progress,
  track,
  fill,
  height = 8,
  radius = 999,
  delay = 0,
  duration = 900,
}: {
  progress: number; // 0..1
  track: string;
  fill: string;
  height?: number;
  radius?: number;
  delay?: number;
  duration?: number;
}) {
  const p = useSharedValue(0);
  const target = Math.max(0, Math.min(1, progress));

  useEffect(() => {
    p.value = withDelay(delay, withTiming(target, { duration, easing: EASE }));
  }, [target, delay, duration]);

  const style = useAnimatedStyle(() => ({ width: `${p.value * 100}%` }));

  return (
    <View style={{ height, backgroundColor: track, borderRadius: radius, overflow: "hidden" }}>
      <Animated.View style={[{ height: "100%", backgroundColor: fill, borderRadius: radius }, style]} />
    </View>
  );
}

// A single vertical bar that grows from the baseline. Used for mini charts.
export function AnimatedBar({
  ratio,
  color,
  maxHeight = 80,
  width = 10,
  radius = 6,
  delay = 0,
  duration = 700,
}: {
  ratio: number; // 0..1 of maxHeight
  color: string;
  maxHeight?: number;
  width?: DimensionValue;
  radius?: number;
  delay?: number;
  duration?: number;
}) {
  const h = useSharedValue(0);
  const target = Math.max(0, Math.min(1, ratio)) * maxHeight;

  useEffect(() => {
    h.value = withDelay(delay, withTiming(target, { duration, easing: EASE }));
  }, [target, delay, duration]);

  const style = useAnimatedStyle(() => ({ height: h.value }));

  return <Animated.View style={[{ width, backgroundColor: color, borderRadius: radius, minHeight: 3 }, style]} />;
}
