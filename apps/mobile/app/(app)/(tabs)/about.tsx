import { ScrollView, View, Text, StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { C } from "../../../lib/theme";
import { LogoMark } from "../../../components/SplashScreen";

const FEATURES = [
  {
    emoji: "💰",
    color: C.accent,
    glow: C.accentFade,
    border: C.accentBorder,
    title: "Finance Tracker",
    desc: "Track every expense, split costs with your partner, and manage monthly budgets — with period filters and bar-chart insights.",
  },
  {
    emoji: "📅",
    color: C.purple,
    glow: C.purpleFade,
    border: C.purpleBorder,
    title: "Shared Calendar",
    desc: "Plan training sessions, competitions, and camps. Entries from both partners appear automatically on a single shared calendar.",
  },
  {
    emoji: "🏆",
    color: C.gold,
    glow: C.goldFade,
    border: C.goldBorder,
    title: "Event Management",
    desc: "Organize tournaments with hotel info, travel logistics, checklists, and expense tracking all in one place.",
  },
  {
    emoji: "🤝",
    color: C.accent,
    glow: C.accentFade,
    border: C.accentBorder,
    title: "Live Partner Sync",
    desc: "Real-time WebSocket synchronization — what one partner adds, the other sees instantly with no manual refresh needed.",
  },
  {
    emoji: "📊",
    color: C.gold,
    glow: C.goldFade,
    border: C.goldBorder,
    title: "Smart Insights",
    desc: "3M / 6M / 1Y period selectors, spending forecasts, accordion month groups, and couple expense split breakdowns.",
  },
] as const;

export default function AboutScreen() {
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero ── */}
      <Animated.View entering={FadeInDown.delay(0).duration(500)} style={styles.hero}>
        <View style={styles.logoWrap}>
          <LogoMark size={96} />
        </View>

        <Text style={styles.appName}>DancePlanner</Text>
        <View style={styles.versionChip}>
          <Text style={styles.versionText}>Version 1.0 · Alpha</Text>
        </View>

        <Text style={styles.mission}>
          Built for competitive dancesport athletes who demand excellence — managing finances, schedules, and partnerships in one elegant platform.
        </Text>
      </Animated.View>

      {/* ── Features ── */}
      <Animated.View entering={FadeInDown.delay(80).duration(400)}>
        <View style={styles.sectionRow}>
          <View style={styles.sectionLine} />
          <Text style={styles.sectionLabel}>WHAT WE OFFER</Text>
          <View style={styles.sectionLine} />
        </View>
      </Animated.View>

      {FEATURES.map((f, i) => (
        <Animated.View
          key={f.title}
          entering={FadeInDown.delay(120 + i * 70).duration(400)}
        >
          <View style={[styles.featureCard, { backgroundColor: f.glow, borderColor: f.border }]}>
            <View style={[styles.featureIconWrap, { backgroundColor: f.glow, borderColor: f.border }]}>
              <Text style={styles.featureEmoji}>{f.emoji}</Text>
            </View>
            <View style={styles.featureBody}>
              <Text style={[styles.featureTitle, { color: f.color }]}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
          </View>
        </Animated.View>
      ))}

      {/* ── Footer ── */}
      <Animated.View entering={FadeInDown.delay(500).duration(400)} style={styles.footer}>
        <View style={styles.footerDivider} />
        <Text style={styles.footerHeart}>Made with ♥ for dancers worldwide</Text>
        <Text style={styles.footerCopy}>© 2025 DancePlanner</Text>
        <Text style={styles.footerSub}>
          Competitive dancesport · Finance & logistics management
        </Text>
      </Animated.View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  content: { paddingHorizontal: 20, paddingTop: 24 },

  // Hero
  hero: {
    alignItems: "center",
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  logoWrap: {
    marginBottom: 20,
    shadowColor: "#10b981",
    shadowOpacity: 0.55,
    shadowRadius: 44,
    shadowOffset: { width: 0, height: 0 },
    elevation: 20,
  },
  appName: {
    color: C.t1,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: -1.2,
    marginBottom: 10,
  },
  versionChip: {
    backgroundColor: C.accentFade,
    borderWidth: 1,
    borderColor: C.accentBorder,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 18,
  },
  versionText: {
    color: C.accent,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  mission: {
    color: C.t2,
    fontSize: 15,
    lineHeight: 24,
    textAlign: "center",
    fontWeight: "400",
  },

  // Section divider
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.border,
  },
  sectionLabel: {
    color: C.t3,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.4,
  },

  // Feature cards
  featureCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    borderRadius: 20,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
  },
  featureIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  featureEmoji: { fontSize: 22 },
  featureBody: { flex: 1 },
  featureTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  featureDesc: {
    color: C.t2,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "400",
  },

  // Footer
  footer: {
    alignItems: "center",
    paddingTop: 8,
    paddingHorizontal: 16,
  },
  footerDivider: {
    width: 40,
    height: 2,
    borderRadius: 1,
    backgroundColor: C.border,
    marginBottom: 20,
  },
  footerHeart: {
    color: C.t2,
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 6,
  },
  footerCopy: {
    color: C.t3,
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 6,
  },
  footerSub: {
    color: C.t3,
    fontSize: 11,
    textAlign: "center",
    lineHeight: 17,
    letterSpacing: 0.2,
  },
});
