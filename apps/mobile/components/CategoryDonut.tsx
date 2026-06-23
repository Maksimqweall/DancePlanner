import { View, Text } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { formatMoney } from "../lib/display";
import { useC } from "../lib/useTheme";

export interface DonutSlice {
  key: string;
  value: number;
  color: string; // hex
}

interface Props {
  data: DonutSlice[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
}

// A donut chart drawn with one stroked circle per slice (rotated into place).
export default function CategoryDonut({
  data,
  size = 180,
  strokeWidth = 26,
  centerLabel = "Total",
}: Props) {
  const T = useC();
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circ = 2 * Math.PI * r;

  let cumulative = 0;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <G>
          <Circle cx={cx} cy={cy} r={r} stroke={T.elevated} strokeWidth={strokeWidth} fill="none" />
          {total > 0 &&
            data.map((d) => {
              const fraction = d.value / total;
              const seg = fraction * circ;
              const angle = (cumulative / total) * 360 - 90;
              cumulative += d.value;
              const gap = data.length > 1 ? 1.5 : 0;
              return (
                <Circle
                  key={d.key}
                  cx={cx}
                  cy={cy}
                  r={r}
                  stroke={d.color}
                  strokeWidth={strokeWidth}
                  fill="none"
                  strokeDasharray={`${Math.max(seg - gap, 0)} ${circ - Math.max(seg - gap, 0)}`}
                  strokeLinecap="butt"
                  transform={`rotate(${angle} ${cx} ${cy})`}
                />
              );
            })}
        </G>
      </Svg>
      <View
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}
      >
        <Text style={{ color: T.t2, fontSize: 12 }}>{centerLabel}</Text>
        <Text style={{ color: T.t1, fontSize: 20, fontWeight: "800" }}>{formatMoney(total)}</Text>
      </View>
    </View>
  );
}
