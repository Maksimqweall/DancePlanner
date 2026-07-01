import React, { useMemo } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Circle, Rect, Line } from "react-native-svg";
import type { Palette } from "../../lib/theme";
import { useC } from "../../lib/useTheme";
import AppBackground from "../../components/ui/AppBackground";

// ── Icons ─────────────────────────────────────────────────────────────────────
function WalletIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2 7C2 5.9 2.9 5 4 5H20C21.1 5 22 5.9 22 7V17C22 18.1 21.1 19 20 19H4C2.9 19 2 18.1 2 17V7Z" stroke={color} strokeWidth="1.75" />
      <Path d="M2 10H22" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
      <Circle cx="16.5" cy="14.5" r="1" fill={color} />
    </Svg>
  );
}
function CalendarIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="4" width="18" height="18" rx="2.5" stroke={color} strokeWidth="1.75" />
      <Path d="M16 2V6M8 2V6M3 10H21" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
    </Svg>
  );
}
function UsersIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="9" cy="8" r="3" stroke={color} strokeWidth="1.75" />
      <Path d="M3 19C3 16.2 5.7 14 9 14C12.3 14 15 16.2 15 19" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
      <Path d="M16 11C17.7 11 19 9.7 19 8C19 6.3 17.7 5 16 5" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
      <Path d="M19 14C20.7 14.8 22 16.2 22 19" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
    </Svg>
  );
}
function TrophyIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 21H16M12 17V21M8.5 4H15.5L14 12C14 14.2 13.1 17 12 17C10.9 17 10 14.2 10 12L8.5 4Z" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <Path d="M8.5 5H5V9C5 10.7 6.3 12 8 12M15.5 5H19V9C19 10.7 17.7 12 16 12" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function StarIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 2L14.9 9.1H22L16.5 13.9L18.6 21L12 16.9L5.4 21L7.5 13.9L2 9.1H9.1L12 2Z" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

// ── Feature data ──────────────────────────────────────────────────────────────
const FEATURES = [
  {
    Icon: WalletIcon,
    color: "#FF5B2E",
    fade: "#FF5B2E15",
    title: "Smart Finance Tracking",
    desc: "Log every expense, set monthly budgets, and see where your money goes — by category, by month, at a glance.",
  },
  {
    Icon: CalendarIcon,
    color: "#FF2D95",
    fade: "#FF2D9515",
    title: "Training Calendar",
    desc: "Schedule sessions and competitions, visualize your weekly training load, and never miss an important date.",
  },
  {
    Icon: UsersIcon,
    color: "#FF5B2E",
    fade: "#FF5B2E15",
    title: "Real-Time Partner Sync",
    desc: "Your partner sees your schedule and expenses the moment you add them — live, bidirectional, always in sync.",
  },
  {
    Icon: TrophyIcon,
    color: "#FFB020",
    fade: "#FFB02015",
    title: "Event Management",
    desc: "Plan competitions and workshops end-to-end: timeline, countdown, budget, travel — all in one place.",
  },
  {
    Icon: StarIcon,
    color: "#EF4444",
    fade: "#EF444415",
    title: "WDSF Integration",
    desc: "Link your official WorldDanceSport profile and access your competition results and license status instantly.",
  },
] as const;

const WHY_ROWS = [
  { accent: "#FF5B2E", label: "Built by competitive dancers", sub: "Every feature comes from real training-hall needs, not guesswork." },
  { accent: "#FF2D95", label: "One app, two athletes", sub: "Designed for couples — partner sync is a first-class feature, not an afterthought." },
  { accent: "#FFB020", label: "Premium without the bloat", sub: "Fast, focused, and beautiful — no upsell traps or dark patterns." },
  { accent: "#10B981", label: "Private by design", sub: "Your data is encrypted and never shared or sold." },
] as const;

const INFO_ROWS = [
  { label: "Version",       value: "0.2.0 (Beta)" },
  { label: "Platform",      value: "iOS · Android" },
  { label: "Built with",    value: "Expo · React Native · Node.js" },
  { label: "Backend",       value: "PostgreSQL · Prisma" },
] as const;

// ── Screen ────────────────────────────────────────────────────────────────────
export default function AboutAppScreen() {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);

  return (
    <View style={{ flex: 1 }}>
      <AppBackground />
      <ScrollView
      style={[s.screen, { backgroundColor: "transparent" }]}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero ── */}
      <Animated.View entering={FadeInUp.delay(0).duration(500)}>
        <LinearGradient
          colors={[C.accent, C.purple] as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          {/* Decorative rings */}
          <View style={s.ring1} />
          <View style={s.ring2} />

          <View style={s.logoWrap}>
            <View style={s.logo}>
              <Text style={s.logoText}>DP</Text>
            </View>
          </View>

          <Text style={s.heroTitle}>Dance Planner</Text>
          <Text style={s.heroTagline}>
            The all-in-one companion for{"\n"}competitive dancesport athletes
          </Text>

          <View style={s.heroBadgeRow}>
            <View style={s.heroBadge}>
              <Text style={s.heroBadgeText}>✦ Premium</Text>
            </View>
            <View style={[s.heroBadge, { backgroundColor: "rgba(255,255,255,0.12)" }]}>
              <Text style={s.heroBadgeText}>v0.2 Beta</Text>
            </View>
          </View>
        </LinearGradient>
      </Animated.View>

      {/* ── Features ── */}
      <Animated.View entering={FadeInDown.delay(180).springify().damping(16).stiffness(140)}>
        <Text style={s.sectionLabel}>FEATURES</Text>
      </Animated.View>

      {FEATURES.map((feat, i) => (
        <Animated.View
          key={feat.title}
          entering={FadeInDown.delay(160 + i * 70).duration(400)}
          style={s.featureCard}
        >
          <View style={[s.featureIconBox, { backgroundColor: feat.fade }]}>
            <feat.Icon color={feat.color} size={22} />
          </View>
          <View style={s.featureBody}>
            <Text style={s.featureTitle}>{feat.title}</Text>
            <Text style={s.featureDesc}>{feat.desc}</Text>
          </View>
        </Animated.View>
      ))}

      {/* ── Why Dance Planner ── */}
      <Animated.View entering={FadeInDown.delay(840).springify().damping(16).stiffness(140)}>
        <Text style={[s.sectionLabel, { marginTop: 8 }]}>WHY DANCE PLANNER</Text>
        <View style={s.whyCard}>
          {WHY_ROWS.map((row, i) => (
            <View key={row.label}>
              {i > 0 && <View style={s.whyDivider} />}
              <View style={s.whyRow}>
                <View style={[s.whyDot, { backgroundColor: row.accent }]} />
                <View style={s.whyText}>
                  <Text style={s.whyLabel}>{row.label}</Text>
                  <Text style={s.whySub}>{row.sub}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </Animated.View>

      {/* ── Build info ── */}
      <Animated.View entering={FadeInDown.delay(960).springify().damping(16).stiffness(140)}>
        <Text style={[s.sectionLabel, { marginTop: 8 }]}>ABOUT THIS APP</Text>
        <View style={s.infoCard}>
          {INFO_ROWS.map((row, i) => (
            <View key={row.label}>
              {i > 0 && <View style={s.rowDivider} />}
              <View style={s.infoRow}>
                <Text style={s.infoLabel}>{row.label}</Text>
                <Text style={s.infoValue}>{row.value}</Text>
              </View>
            </View>
          ))}
        </View>
      </Animated.View>

      {/* ── Footer ── */}
      <Animated.View entering={FadeInDown.delay(1080).springify().damping(16).stiffness(140)} style={s.footer}>
        <View style={s.footerLogo}>
          <Text style={s.footerLogoText}>DP</Text>
        </View>
        <Text style={s.footerLine}>Made with passion for dance</Text>
        <Text style={s.footerCopy}>© 2025 Dance Planner. All rights reserved.</Text>
      </Animated.View>

      <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
function makeStyles(C: Palette) {
  return StyleSheet.create({
    screen:  { flex: 1, backgroundColor: C.bg },
    content: { paddingBottom: 16 },

    // Hero
    hero: {
      alignItems: "center",
      paddingTop: 48,
      paddingBottom: 44,
      paddingHorizontal: 24,
      marginBottom: 28,
      overflow: "hidden",
      position: "relative",
    },
    ring1: {
      position: "absolute",
      width: 260,
      height: 260,
      borderRadius: 130,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.12)",
      top: -60,
      right: -60,
    },
    ring2: {
      position: "absolute",
      width: 180,
      height: 180,
      borderRadius: 90,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.08)",
      bottom: -40,
      left: -40,
    },
    logoWrap: {
      marginBottom: 20,
      shadowColor: "#000",
      shadowOpacity: 0.3,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
    },
    logo: {
      width: 84,
      height: 84,
      borderRadius: 26,
      backgroundColor: "rgba(255,255,255,0.18)",
      borderWidth: 2,
      borderColor: "rgba(255,255,255,0.35)",
      alignItems: "center",
      justifyContent: "center",
    },
    logoText: {
      color: "#fff",
      fontSize: 30,
      fontWeight: "900",
      letterSpacing: -1.5,
    },
    heroTitle: {
      color: "#fff",
      fontSize: 30,
      fontWeight: "900",
      letterSpacing: -0.8,
      marginBottom: 10,
    },
    heroTagline: {
      color: "rgba(255,255,255,0.75)",
      fontSize: 15,
      fontWeight: "500",
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 22,
    },
    heroBadgeRow: {
      flexDirection: "row",
      gap: 10,
    },
    heroBadge: {
      backgroundColor: "rgba(255,255,255,0.18)",
      borderRadius: 20,
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.25)",
    },
    heroBadgeText: {
      color: "#fff",
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.3,
    },

    // Section label
    sectionLabel: {
      color: C.t3,
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 1.2,
      marginBottom: 10,
      marginLeft: 4,
      paddingHorizontal: 20,
    },

    // Feature cards
    featureCard: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 14,
      backgroundColor: C.card,
      borderRadius: 18,
      marginHorizontal: 16,
      marginBottom: 10,
      padding: 16,
      borderWidth: 1,
      borderColor: C.border,
    },
    featureIconBox: {
      width: 46,
      height: 46,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    featureBody: { flex: 1 },
    featureTitle: {
      color: C.t1,
      fontSize: 15,
      fontWeight: "700",
      letterSpacing: -0.2,
      marginBottom: 4,
    },
    featureDesc: {
      color: C.t2,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: "400",
    },

    // Why section
    whyCard: {
      backgroundColor: C.card,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: C.borderStrong,
      marginHorizontal: 16,
      marginBottom: 8,
      paddingVertical: 4,
      overflow: "hidden",
    },
    whyRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 14,
      paddingVertical: 16,
      paddingHorizontal: 18,
    },
    whyDivider: {
      height: 1,
      backgroundColor: C.border,
      marginHorizontal: 18,
    },
    whyDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      marginTop: 5,
      flexShrink: 0,
    },
    whyText: { flex: 1 },
    whyLabel: {
      color: C.t1,
      fontSize: 14,
      fontWeight: "700",
      letterSpacing: -0.2,
      marginBottom: 3,
    },
    whySub: {
      color: C.t2,
      fontSize: 13,
      lineHeight: 18,
    },

    // Info card
    infoCard: {
      backgroundColor: C.card,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: C.borderStrong,
      marginHorizontal: 16,
      marginBottom: 24,
      overflow: "hidden",
    },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    rowDivider: {
      height: 1,
      backgroundColor: C.border,
      marginHorizontal: 18,
    },
    infoLabel: {
      color: C.t3,
      fontSize: 13,
      fontWeight: "500",
    },
    infoValue: {
      color: C.t1,
      fontSize: 13,
      fontWeight: "600",
    },

    // Footer
    footer: {
      alignItems: "center",
      paddingTop: 8,
      paddingBottom: 16,
      gap: 8,
    },
    footerLogo: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: C.accentFade,
      borderWidth: 1,
      borderColor: C.accentBorder,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    footerLogoText: {
      color: C.accent,
      fontSize: 13,
      fontWeight: "900",
      letterSpacing: -0.5,
    },
    footerLine: {
      color: C.t2,
      fontSize: 13,
      fontWeight: "600",
    },
    footerCopy: {
      color: C.t3,
      fontSize: 11,
    },
  });
}
