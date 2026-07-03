import React, { useMemo, useEffect } from "react";
import { View, StyleSheet, Platform, Pressable, type ViewStyle, type StyleProp, type GestureResponderEvent } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { SHADOWS, glow as glowStyle, SPRING, type Palette } from "../../lib/theme";
import { useC } from "../../lib/useTheme";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ShadowLevel = keyof typeof SHADOWS;

interface Props {
  children: React.ReactNode;
  /** Blur strength (expo-blur `intensity`, 0-100). Set 0 for cheap "glass-tint only" rows in long lists. */
  intensity?: number;
  shadow?: ShadowLevel;
  glowColor?: string;
  /** Overrides the neutral dark tint with a semantic color wash (e.g. a project's brand color). */
  tintColor?: string;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  /** Makes the card tappable: scales down, brightens the sheen and flares the glow. */
  onPress?: (e: GestureResponderEvent) => void;
  disabled?: boolean;
  /** Slow ambient highlight sweep, for hero widgets that should feel "alive" at rest. */
  shimmer?: boolean;
  /** Reacts to touch (scale + sheen) even with no onPress — for tactile-only cards. */
  interactive?: boolean;
}

// iOS26 "Liquid Glass" surface: a real background blur (BlurView) so the warm
// neon glow behind the screen shows through, a thin translucent tint (NOT a
// solid card color — glass should stay mostly see-through), and a bright
// specular highlight along the top edge to sell the refraction. Every card
// also reacts to touch (scale + brighter sheen + glow flare) so the whole app
// feels like a stack of tactile widgets rather than static panels.
export default function GlassCard({
  children,
  intensity = 36,
  shadow,
  glowColor,
  tintColor,
  radius = 24,
  style,
  contentStyle,
  onPress,
  disabled,
  shimmer = false,
  interactive = false,
}: Props) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  const pressable = interactive || !!onPress;

  const press = useSharedValue(0); // 0 = resting, 1 = pressed
  const shimmerX = useSharedValue(-1);

  useEffect(() => {
    if (!shimmer) return;
    shimmerX.value = withDelay(
      Math.random() * 1400,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }),
          withTiming(-1, { duration: 0 }),
          withTiming(-1, { duration: 1400 }),
        ),
        -1,
        false,
      ),
    );
  }, [shimmer]);

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - press.value * 0.022 }],
  }));
  const sheenStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + press.value * 0.4,
  }));
  const glowFlareStyle = useAnimatedStyle(() => ({
    opacity: press.value,
  }));
  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: `${shimmerX.value * 140}%` }],
  }));

  const body = (
    <Animated.View
      style={[
        { borderRadius: radius, overflow: "hidden" },
        shadow ? SHADOWS[shadow] : null,
        glowColor ? glowStyle(glowColor) : null,
        pressable ? scaleStyle : null,
        style,
      ]}
    >
      {intensity > 0 ? (
        <BlurView
          intensity={Platform.OS === "web" ? 0 : intensity}
          tint="dark"
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View style={[s.tint, { borderRadius: radius }, tintColor ? { backgroundColor: tintColor } : null]} />
      <Animated.View style={[s.sheen, pressable ? sheenStyle : null]} pointerEvents="none">
        <LinearGradient
          colors={["rgba(255,255,255,0.32)", "rgba(255,255,255,0)"]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      {shimmer ? (
        <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle]} pointerEvents="none">
          <LinearGradient
            colors={["transparent", "rgba(255,255,255,0.16)", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
      {glowColor && pressable ? (
        <Animated.View
          style={[StyleSheet.absoluteFill, { borderRadius: radius, borderWidth: 1.5, borderColor: glowColor }, glowFlareStyle]}
          pointerEvents="none"
        />
      ) : null}
      <View style={[s.content, contentStyle]}>{children}</View>
    </Animated.View>
  );

  if (!pressable) return body;

  return (
    <AnimatedPressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => { press.value = withSpring(1, SPRING.press); }}
      onPressOut={() => { press.value = withSpring(0, SPRING.press); }}
    >
      {body}
    </AnimatedPressable>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
    tint: {
      position: "absolute",
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(24,16,18,0.32)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.26)",
    },
    sheen: {
      position: "absolute",
      top: 0, left: 0, right: 0,
      height: "45%",
      opacity: 0.5,
    },
    content: { padding: 18 },
  });
}
