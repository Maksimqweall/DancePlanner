import { useEffect } from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  withSequence,
  withRepeat,
  Easing,
  runOnJS,
} from "react-native-reanimated";
import Svg, { Circle, Path } from "react-native-svg";

const { width, height } = Dimensions.get("window");
const ACCENT = "#10b981";
const BG = "#07070a";

// ── Shared logo mark (also used in About screen) ───────────────────────────
export function LogoMark({ size = 100 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Base circle */}
      <Circle cx="50" cy="50" r="50" fill="#0e0e14" />
      {/* Outer emerald ring */}
      <Circle cx="50" cy="50" r="46" fill="none" stroke={ACCENT} strokeWidth="1.8" />
      {/* Inner subtle ring */}
      <Circle cx="50" cy="50" r="36" fill="none" stroke="rgba(16,185,129,0.15)" strokeWidth="1" />

      {/* Lead dancer arc — brighter */}
      <Path
        d="M50 18 C67 18 80 32 80 46 C80 60 70 67 58 67 C46 67 41 74 41 80"
        stroke={ACCENT}
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
      {/* Follow dancer arc — softer */}
      <Path
        d="M50 18 C33 18 20 32 20 46 C20 60 30 67 42 67 C54 67 59 74 59 80"
        stroke="rgba(16,185,129,0.40)"
        strokeWidth="3"
        fill="none"
        strokeLinecap="round"
      />

      {/* Center jewel */}
      <Circle cx="50" cy="50" r="5.5" fill={ACCENT} />
      <Circle cx="50" cy="50" r="2.5" fill="rgba(255,255,255,0.9)" />
    </Svg>
  );
}

// ── Splash screen ──────────────────────────────────────────────────────────
export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  // Master
  const masterO = useSharedValue(1);

  // Ambient orbs
  const orb1O = useSharedValue(0);
  const orb1S = useSharedValue(0.4);
  const orb2O = useSharedValue(0);
  const orb3O = useSharedValue(0);

  // Pulse rings
  const ring1S = useSharedValue(1);
  const ring1O = useSharedValue(0);
  const ring2S = useSharedValue(1);
  const ring2O = useSharedValue(0);

  // Logo
  const logoS = useSharedValue(0.25);
  const logoO = useSharedValue(0);
  const logoR = useSharedValue(-12);

  // Text
  const titleO = useSharedValue(0);
  const titleY = useSharedValue(22);
  const tagO   = useSharedValue(0);
  const tagY   = useSharedValue(14);
  const botO   = useSharedValue(0);

  // Dots
  const d1O = useSharedValue(0);
  const d2O = useSharedValue(0);
  const d3O = useSharedValue(0);

  useEffect(() => {
    // ── Ambient orbs
    orb1O.value = withTiming(1,   { duration: 800 });
    orb1S.value = withTiming(1,   { duration: 1400, easing: Easing.out(Easing.cubic) });
    orb2O.value = withDelay(180,  withTiming(0.75, { duration: 800 }));
    orb3O.value = withDelay(350,  withTiming(0.55, { duration: 800 }));

    // ── Pulse rings (two pulses expand from logo)
    const pulse = (ringS: typeof ring1S, ringO: typeof ring1O, delay: number) => {
      ringS.value = withDelay(delay, withRepeat(
        withSequence(
          withTiming(1,   { duration: 0 }),
          withTiming(3.8, { duration: 1500, easing: Easing.out(Easing.cubic) })
        ), 2, false
      ));
      ringO.value = withDelay(delay, withRepeat(
        withSequence(
          withTiming(0.5, { duration: 120 }),
          withTiming(0,   { duration: 1380, easing: Easing.out(Easing.cubic) })
        ), 2, false
      ));
    };
    pulse(ring1S, ring1O, 180);
    pulse(ring2S, ring2O, 550);

    // ── Logo bounce in
    logoS.value = withDelay(220, withSpring(1,    { damping: 11, stiffness: 140 }));
    logoO.value = withDelay(220, withTiming(1,    { duration: 450 }));
    logoR.value = withDelay(220, withSpring(0,    { damping: 14, stiffness: 180 }));

    // ── Title
    titleO.value = withDelay(640, withTiming(1,   { duration: 520, easing: Easing.out(Easing.cubic) }));
    titleY.value = withDelay(640, withSpring(0,   { damping: 18, stiffness: 170 }));

    // ── Tagline
    tagO.value = withDelay(880, withTiming(1,     { duration: 420 }));
    tagY.value = withDelay(880, withSpring(0,     { damping: 18, stiffness: 170 }));

    // ── Bottom caption
    botO.value = withDelay(1050, withTiming(1,    { duration: 400 }));

    // ── Loading dots (staggered breathe)
    const dot = (sv: typeof d1O, delay: number) => {
      sv.value = withDelay(delay, withRepeat(
        withSequence(withTiming(1, { duration: 340 }), withTiming(0.2, { duration: 340 })),
        -1, true
      ));
    };
    dot(d1O, 1120);
    dot(d2O, 1310);
    dot(d3O, 1500);

    // ── Exit
    masterO.value = withDelay(2700, withTiming(0, { duration: 520, easing: Easing.in(Easing.cubic) }, () => {
      runOnJS(onFinish)();
    }));
  }, []);

  const masterStyle = useAnimatedStyle(() => ({ opacity: masterO.value }));
  const orb1Style   = useAnimatedStyle(() => ({ opacity: orb1O.value, transform: [{ scale: orb1S.value }] }));
  const orb2Style   = useAnimatedStyle(() => ({ opacity: orb2O.value }));
  const orb3Style   = useAnimatedStyle(() => ({ opacity: orb3O.value }));
  const ring1Style  = useAnimatedStyle(() => ({ opacity: ring1O.value, transform: [{ scale: ring1S.value }] }));
  const ring2Style  = useAnimatedStyle(() => ({ opacity: ring2O.value, transform: [{ scale: ring2S.value }] }));
  const logoStyle   = useAnimatedStyle(() => ({
    opacity: logoO.value,
    transform: [{ scale: logoS.value }, { rotate: `${logoR.value}deg` }],
  }));
  const titleStyle  = useAnimatedStyle(() => ({ opacity: titleO.value, transform: [{ translateY: titleY.value }] }));
  const tagStyle    = useAnimatedStyle(() => ({ opacity: tagO.value,   transform: [{ translateY: tagY.value }] }));
  const botStyle    = useAnimatedStyle(() => ({ opacity: botO.value }));
  const dot1Style   = useAnimatedStyle(() => ({ opacity: d1O.value }));
  const dot2Style   = useAnimatedStyle(() => ({ opacity: d2O.value }));
  const dot3Style   = useAnimatedStyle(() => ({ opacity: d3O.value }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, s.container, masterStyle]}>

      {/* ── Ambient background orbs ── */}
      <Animated.View style={[s.orb1, orb1Style]} />
      <Animated.View style={[s.orb2, orb2Style]} />
      <Animated.View style={[s.orb3, orb3Style]} />

      {/* ── Pulse rings (centered) ── */}
      <Animated.View style={[s.ring, ring1Style]} />
      <Animated.View style={[s.ring, ring2Style]} />

      {/* ── Main content ── */}
      <View style={s.center}>

        {/* Logo */}
        <Animated.View style={[s.logoWrap, logoStyle]}>
          <LogoMark size={108} />
        </Animated.View>

        {/* App name */}
        <Animated.Text style={[s.appName, titleStyle]}>
          DancePlanner
        </Animated.Text>

        {/* Tagline */}
        <Animated.Text style={[s.tagline, tagStyle]}>
          Elevate your competitive journey
        </Animated.Text>

        {/* Breathing dots */}
        <View style={s.dotsRow}>
          <Animated.View style={[s.dot, dot1Style]} />
          <Animated.View style={[s.dot, dot2Style]} />
          <Animated.View style={[s.dot, dot3Style]} />
        </View>
      </View>

      {/* Bottom label */}
      <Animated.Text style={[s.bottomLabel, botStyle]}>
        for competitive dancesport athletes
      </Animated.Text>

    </Animated.View>
  );
}

const RING_SIZE = 108;

const s = StyleSheet.create({
  container: {
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
  },

  // Ambient orbs
  orb1: {
    position: "absolute",
    top: -height * 0.18,
    left: -width * 0.25,
    width:  width * 1.1,
    height: width * 1.1,
    borderRadius: width * 0.55,
    backgroundColor: "rgba(16,185,129,0.09)",
  },
  orb2: {
    position: "absolute",
    bottom: -height * 0.1,
    right: -width * 0.15,
    width:  width * 0.85,
    height: width * 0.85,
    borderRadius: width * 0.43,
    backgroundColor: "rgba(168,85,247,0.06)",
  },
  orb3: {
    position: "absolute",
    top: height * 0.45,
    left: -width * 0.1,
    width:  width * 0.7,
    height: width * 0.7,
    borderRadius: width * 0.35,
    backgroundColor: "rgba(245,158,11,0.045)",
  },

  // Pulse rings
  ring: {
    position: "absolute",
    width:  RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1.5,
    borderColor: ACCENT,
  },

  // Content
  center: {
    alignItems: "center",
  },
  logoWrap: {
    marginBottom: 32,
    shadowColor: ACCENT,
    shadowOpacity: 0.6,
    shadowRadius: 48,
    shadowOffset: { width: 0, height: 0 },
    elevation: 24,
  },
  appName: {
    color: "#f0f0f8",
    fontSize: 38,
    fontWeight: "800",
    letterSpacing: -1.4,
    marginBottom: 10,
  },
  tagline: {
    color: "rgba(142,142,160,0.85)",
    fontSize: 14,
    fontWeight: "500",
    letterSpacing: 0.3,
    marginBottom: 52,
  },

  // Dots
  dotsRow: {
    flexDirection: "row",
    gap: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: ACCENT,
  },

  // Bottom
  bottomLabel: {
    position: "absolute",
    bottom: 52,
    color: "rgba(68,68,90,0.9)",
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
});
