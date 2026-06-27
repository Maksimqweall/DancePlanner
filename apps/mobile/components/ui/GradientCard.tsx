import React, { useMemo } from "react";
import { View, StyleSheet, type ViewStyle, type StyleProp } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SURFACE_TINTS, SHADOWS, glow as glowStyle, type Palette } from "../../lib/theme";
import { useC } from "../../lib/useTheme";

type ShadowLevel = keyof typeof SHADOWS;
type TintName = keyof typeof SURFACE_TINTS;

interface Props {
  children: React.ReactNode;
  /** Soft frosted gradient sweep behind the content. Omit for a plain surface. */
  tint?: TintName;
  /** Drop-shadow depth. */
  shadow?: ShadowLevel;
  /** Coloured halo (e.g. an accent hex) under the card. */
  glowColor?: string;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  /** Inner padding container style. */
  contentStyle?: StyleProp<ViewStyle>;
}

// A premium card surface: solid themed background + optional frosted gradient tint,
// a soft drop shadow, and an optional coloured glow. Use across screens so every
// card shares the same depth language.
export default function GradientCard({
  children,
  tint,
  shadow = "md",
  glowColor,
  radius = 22,
  style,
  contentStyle,
}: Props) {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);

  return (
    <View
      style={[
        s.card,
        { borderRadius: radius },
        SHADOWS[shadow],
        glowColor ? glowStyle(glowColor) : null,
        style,
      ]}
    >
      {tint ? (
        <LinearGradient
          colors={SURFACE_TINTS[tint] as unknown as readonly [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        />
      ) : null}
      <View style={[s.content, contentStyle]}>{children}</View>
    </View>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
    card: {
      backgroundColor: C.card,
      borderWidth: 1,
      borderColor: C.border,
      overflow: "hidden",
    },
    content: { padding: 18 },
  });
}
