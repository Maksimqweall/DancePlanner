import React, { useMemo } from "react";
import { View, StyleSheet, Platform, type ViewStyle, type StyleProp } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { SHADOWS, glow as glowStyle, type Palette } from "../../lib/theme";
import { useC } from "../../lib/useTheme";

type ShadowLevel = keyof typeof SHADOWS;

interface Props {
  children: React.ReactNode;
  /** Blur strength (expo-blur `intensity`, 0-100). */
  intensity?: number;
  shadow?: ShadowLevel;
  glowColor?: string;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}

// iOS26 "Liquid Glass" surface: a real background blur (BlurView) so the warm
// neon glow behind the screen shows through, a thin translucent tint (NOT a
// solid card color — glass should stay mostly see-through), and a bright
// specular highlight along the top edge to sell the refraction. Use for hero
// overlays, floating bars, sheets and widgets that should feel like they're
// hovering above the page.
export default function GlassCard({
  children,
  intensity = 30,
  shadow,
  glowColor,
  radius = 24,
  style,
  contentStyle,
}: Props) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);

  return (
    <View
      style={[
        { borderRadius: radius, overflow: "hidden" },
        shadow ? SHADOWS[shadow] : null,
        glowColor ? glowStyle(glowColor) : null,
        style,
      ]}
    >
      <BlurView
        intensity={Platform.OS === "web" ? 0 : intensity}
        tint="dark"
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <View style={[s.tint, { borderRadius: radius }]} />
      <LinearGradient
        colors={["rgba(255,255,255,0.32)", "rgba(255,255,255,0)"]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={s.sheen}
        pointerEvents="none"
      />
      <View style={[s.content, contentStyle]}>{children}</View>
    </View>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
    tint: {
      position: "absolute",
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(20,14,16,0.55)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.24)",
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
