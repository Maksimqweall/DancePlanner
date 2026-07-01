import React from "react";
import { StyleSheet, type ViewStyle, type StyleProp } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import PressableScale from "./PressableScale";
import { GRADIENTS } from "../../lib/theme";

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  /** Gradient stops — defaults to the brand sweep. */
  colors?: readonly [string, string, ...string[]];
  /** Outer container style (margins, width, etc.). */
  style?: StyleProp<ViewStyle>;
  /** Inner fill style override (padding / alignment). */
  contentStyle?: StyleProp<ViewStyle>;
  /** Soft colored shadow under the button. */
  glow?: boolean;
  radius?: number;
}

// Primary call-to-action with a diagonal gradient fill, press-scale, and a soft
// glow. Drop-in replacement for a solid-accent button — keep your own <Text>
// children for full control over the label.
export default function GradientButton({
  children,
  onPress,
  disabled = false,
  colors = GRADIENTS.brand,
  style,
  contentStyle,
  glow = true,
  radius = 14,
}: Props) {
  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.97}
      style={[
        { borderRadius: radius },
        glow && styles.glow,
        disabled && styles.disabled,
        style,
      ]}
    >
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.fill, { borderRadius: radius }, contentStyle]}
      >
        {children}
      </LinearGradient>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  fill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  glow: {
    shadowColor: "#FF3D68",
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  disabled: { opacity: 0.6 },
});
