import React from "react";
import { StyleSheet, useWindowDimensions } from "react-native";
import Svg, { Defs, RadialGradient, Stop, Rect } from "react-native-svg";
import { useC } from "../../lib/useTheme";

// Full-bleed ambient backdrop: soft neon blobs glowing through a warm charcoal
// base. This sits behind every screen so glass widgets always have real color
// bleeding through them (the "Liquid Glass" look only works over color, never
// over flat black). Render once behind a screen's ScrollView/content.
export default function AppBackground() {
  const C = useC();
  const { width: w, height: h } = useWindowDimensions();

  return (
    <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="glowTop" cx="15%" cy="0%" r="55%">
          <Stop offset="0%" stopColor="#FF5B2E" stopOpacity={0.38} />
          <Stop offset="100%" stopColor="#FF5B2E" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="glowRight" cx="100%" cy="28%" r="50%">
          <Stop offset="0%" stopColor="#C724B1" stopOpacity={0.30} />
          <Stop offset="100%" stopColor="#C724B1" stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="glowBottom" cx="30%" cy="100%" r="60%">
          <Stop offset="0%" stopColor="#FF2D95" stopOpacity={0.28} />
          <Stop offset="100%" stopColor="#FF2D95" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} fill={C.bg} />
      <Rect x={0} y={0} width={w} height={h} fill="url(#glowTop)" />
      <Rect x={0} y={0} width={w} height={h} fill="url(#glowRight)" />
      <Rect x={0} y={0} width={w} height={h} fill="url(#glowBottom)" />
    </Svg>
  );
}
