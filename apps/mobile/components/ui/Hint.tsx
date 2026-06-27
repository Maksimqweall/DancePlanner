import React, { useMemo } from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import PressableScale from "./PressableScale";
import { GRADIENTS, SHADOWS, glow, type Palette, type GradientName } from "../../lib/theme";
import { useC } from "../../lib/useTheme";
import { useHintsStore } from "../../store/useHintsStore";

interface Props {
  /** Stable id — once dismissed, this hint never shows again for the user. */
  id: string;
  title: string;
  text: string;
  /** Accent gradient for the icon chip + glow. */
  gradient?: GradientName;
  icon?: "bulb" | "spark" | "info";
  style?: StyleProp<ViewStyle>;
}

const ICON_PATHS: Record<NonNullable<Props["icon"]>, string> = {
  // Lightbulb
  bulb: "M9 21h6v-1H9v1zm3-19a7 7 0 0 0-4 12.74V17h8v-2.26A7 7 0 0 0 12 2z",
  // Sparkle
  spark: "M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2z",
  // Info
  info: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z",
};

// A dismissible, context-aware tip for new users. Renders nothing once dismissed.
// Mount it near the relevant UI and give it a unique, stable `id`.
export default function Hint({ id, title, text, gradient = "brand", icon = "bulb", style }: Props) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  const dismissed = useHintsStore((st) => !!st.dismissed[id]);
  const dismiss = useHintsStore((st) => st.dismiss);

  if (dismissed) return null;

  const colors = GRADIENTS[gradient];

  return (
    <Animated.View
      entering={FadeInDown.duration(420)}
      exiting={FadeOut.duration(220)}
      style={[s.card, glow(colors[0], 16, 0.28), style]}
    >
      <LinearGradient
        colors={[`${colors[0]}1F`, "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.accentBar} />

      <View style={s.iconChip}>
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <Svg width={16} height={16} viewBox="0 0 24 24">
          <Path d={ICON_PATHS[icon]} fill="#fff" />
        </Svg>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={s.title}>{title}</Text>
        <Text style={s.text}>{text}</Text>
      </View>

      <PressableScale style={s.close} onPress={() => dismiss(id)} hitSlop={8}>
        <Svg width={14} height={14} viewBox="0 0 24 24">
          <Path d="M6 6l12 12M18 6L6 18" stroke={C.t2} strokeWidth={2.4} strokeLinecap="round" />
        </Svg>
      </PressableScale>
    </Animated.View>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
      borderRadius: 18,
      paddingVertical: 14,
      paddingLeft: 18,
      paddingRight: 12,
      marginHorizontal: 20,
      marginBottom: 6,
      overflow: "hidden",
      ...SHADOWS.sm,
    },
    accentBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
    iconChip: {
      width: 30, height: 30, borderRadius: 10, overflow: "hidden",
      alignItems: "center", justifyContent: "center", marginTop: 1,
    },
    title: { color: C.t1, fontSize: 14, fontWeight: "800", letterSpacing: -0.2 },
    text: { color: C.t2, fontSize: 12.5, lineHeight: 18, marginTop: 3 },
    close: { padding: 4, marginTop: -2 },
  });
}
