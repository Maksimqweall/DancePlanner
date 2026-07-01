import React, { useEffect, useMemo } from "react";
import { View, Text, Pressable, StyleSheet, Platform } from "react-native";
import { BlurView } from "expo-blur";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useSegments } from "expo-router";
import Svg, { Path, Rect, Circle, Line } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { C, GRADIENTS } from "../lib/theme";
import type { Palette } from "../lib/theme";
import { useC } from "../lib/useTheme";
import { useT } from "../lib/i18n";
import { useDrawer } from "../lib/DrawerContext";
import { useAuthStore } from "../store/useAuthStore";
import { usePartnerStore } from "../store/usePartnerStore";
import { useWdsfStore } from "../store/useWdsfStore";
import type { Href } from "expo-router";

const DRAWER_W = 290;

// ── Icons ────────────────────────────────────────────────────────────────────
function HomeIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 12L12 3L21 12V21H15V15H9V21H3V12Z" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}
function CalendarIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="4" width="18" height="18" rx="2.5" stroke={color} strokeWidth="1.75" />
      <Path d="M16 2V6M8 2V6M3 10H21" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
    </Svg>
  );
}
function WalletIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2 7C2 5.9 2.9 5 4 5H20C21.1 5 22 5.9 22 7V17C22 18.1 21.1 19 20 19H4C2.9 19 2 18.1 2 17V7Z" stroke={color} strokeWidth="1.75" />
      <Path d="M2 10H22" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
      <Circle cx="16.5" cy="14.5" r="1" fill={color} />
    </Svg>
  );
}
function TrophyIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 21H16M12 17V21M8.5 4H15.5L14 12C14 14.2 13.1 17 12 17C10.9 17 10 14.2 10 12L8.5 4Z" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <Path d="M8.5 5H5V9C5 10.7 6.3 12 8 12M15.5 5H19V9C19 10.7 17.7 12 16 12" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function UsersIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="9" cy="8" r="3" stroke={color} strokeWidth="1.75" />
      <Path d="M3 19C3 16.2 5.7 14 9 14C12.3 14 15 16.2 15 19" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
      <Path d="M16 11C17.7 11 19 9.7 19 8C19 6.3 17.7 5 16 5" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
      <Path d="M19 14C20.7 14.8 22 16.2 22 19" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
    </Svg>
  );
}
function InfoIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.75" />
      <Path d="M12 8V8.5M12 11V16" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
    </Svg>
  );
}
function MedalIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8.5 3L11 8.5M15.5 3L13 8.5" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
      <Circle cx="12" cy="15" r="6" stroke={color} strokeWidth="1.75" />
      <Path d="M12 12.2L13 14.3L15.3 14.6L13.6 16.2L14 18.5L12 17.4L10 18.5L10.4 16.2L8.7 14.6L11 14.3L12 12.2Z" fill={color} />
    </Svg>
  );
}
function RatingIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3L14.5 8.6L20.5 9.3L16 13.3L17.3 19.2L12 16.1L6.7 19.2L8 13.3L3.5 9.3L9.5 8.6L12 3Z" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}
function LeaderboardIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="9.5" y="7" width="5" height="14" rx="1" stroke={color} strokeWidth="1.75" strokeLinejoin="round" />
      <Rect x="3" y="12" width="5" height="9" rx="1" stroke={color} strokeWidth="1.75" strokeLinejoin="round" />
      <Rect x="16" y="14" width="5" height="7" rx="1" stroke={color} strokeWidth="1.75" strokeLinejoin="round" />
      <Path d="M12 2L12.7 3.5L14.3 3.7L13.1 4.8L13.4 6.4L12 5.6L10.6 6.4L10.9 4.8L9.7 3.7L11.3 3.5L12 2Z" fill={color} />
    </Svg>
  );
}
function AnalyzeIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="4" y="3" width="16" height="18" rx="2.5" stroke={color} strokeWidth="1.75" />
      <Path d="M8 8H16M8 12H13" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
      <Path d="M14.5 15.5L16 17L19 14" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function LogoutIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 21H5C4.47 21 3.96 20.79 3.59 20.41C3.21 20.04 3 19.53 3 19V5C3 4.47 3.21 3.96 3.59 3.59C3.96 3.21 4.47 3 5 3H9" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 17L21 12L16 7" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="21" y1="12" x2="9" y2="12" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
    </Svg>
  );
}

// ── Nav items ────────────────────────────────────────────────────────────────
const NAV_MAIN = [
  { key: "index",    label: "Dashboard", href: "/",         icon: HomeIcon,     accent: C.accent },
  { key: "calendar", label: "Calendar",  href: "/calendar", icon: CalendarIcon, accent: C.purple },
  { key: "expenses", label: "Finance",   href: "/expenses", icon: WalletIcon,   accent: C.accent },
  { key: "projects", label: "Events",    href: "/projects", icon: TrophyIcon,   accent: C.gold   },
  { key: "partner",  label: "Partner",   href: "/partner",  icon: UsersIcon,    accent: C.accent },
] as const;

const NAV_SECONDARY = [
  { key: "about-app", label: "About Us", href: "/about-app", icon: InfoIcon, accent: C.purple },
] as const;

// ── Component ────────────────────────────────────────────────────────────────
export default function SideDrawer() {
  const { isOpen, close } = useDrawer();
  const T         = useC();
  const lang      = useT();
  const s         = useMemo(() => makeStyles(T), [T]);
  const router    = useRouter();
  const segments  = useSegments();
  const insets    = useSafeAreaInsets();
  const user      = useAuthStore((st) => st.user);
  const logout    = useAuthStore((st) => st.logout);
  const pending   = usePartnerStore((st) => st.pendingCount);
  const wdsfLinked = useWdsfStore((st) => !!st.profile);

  const navLabels: Record<string, string> = {
    index:     lang.nav.dashboard,
    calendar:  lang.nav.calendar,
    expenses:  lang.nav.finance,
    projects:  lang.nav.events,
    partner:   lang.nav.partner,
    "about-app": lang.nav.aboutUs,
    rating:    lang.nav.rating,
    leaderboard: lang.nav.leaderboard,
    "manual-analysis": lang.nav.manualAnalysis,
  };

  const translateX     = useSharedValue(-DRAWER_W - 24);
  const backdropO      = useSharedValue(0);

  useEffect(() => {
    if (isOpen) {
      translateX.value   = withSpring(0,  { damping: 22, stiffness: 260, mass: 0.8 });
      backdropO.value    = withTiming(1,  { duration: 230 });
    } else {
      translateX.value   = withSpring(-DRAWER_W - 24, { damping: 22, stiffness: 260, mass: 0.8 });
      backdropO.value    = withTiming(0,  { duration: 200 });
    }
  }, [isOpen]);

  const panelStyle   = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropO.value }));

  const lastSeg  = segments[segments.length - 1];
  const activeKey = lastSeg === "(tabs)" || lastSeg === "(app)" ? "index" : lastSeg;

  const navigate = (href: string) => {
    close();
    router.navigate(href as Href);
  };

  const handleLogout = () => { close(); logout(); };

  const initials = (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "");

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={isOpen ? "auto" : "none"}>

      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close}>
          <View style={s.backdropFill} />
        </Pressable>
      </Animated.View>

      {/* Panel */}
      <Animated.View style={[
        s.panel,
        panelStyle,
        { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 },
      ]}>
        <BlurView
          intensity={Platform.OS === "web" ? 0 : 50}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />

        {/* ── User card ── */}
        <View style={s.userCard}>
          {/* Avatar with glow */}
          <View style={s.avatarWrap}>
            <View style={s.avatarGlow} />
            <LinearGradient
              colors={GRADIENTS.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.avatar}
            >
              <Text style={[s.avatarText, { color: "#fff" }]}>{initials || "?"}</Text>
            </LinearGradient>
          </View>
          <View style={s.userInfo}>
            <Text style={s.userName} numberOfLines={1}>
              {user?.firstName} {user?.lastName}
            </Text>
            <Text style={s.userEmail} numberOfLines={1}>{user?.email}</Text>
          </View>
        </View>

        {/* ── Divider ── */}
        <View style={s.divider} />

        {/* ── Main navigation ── */}
        <View style={s.navGroup}>
          <Text style={s.navGroupLabel}>{lang.nav.navSection}</Text>
          {NAV_MAIN.map(({ key, href, icon: Icon, accent }) => {
            const active = key === activeKey;
            const badge  = key === "partner" && pending > 0;
            return (
              <NavItem
                key={key}
                label={navLabels[key] ?? key}
                active={active}
                accent={accent}
                badge={badge ? pending : 0}
                icon={<Icon color={active ? "#fff" : T.t2} size={20} />}
                onPress={() => navigate(href)}
              />
            );
          })}
        </View>

        {/* ── Secondary navigation ── */}
        <View style={[s.navGroup, { marginTop: 8 }]}>
          <Text style={s.navGroupLabel}>{lang.nav.moreSection}</Text>
          {wdsfLinked ? (
            <NavItem
              label={lang.nav.wdsfProfile}
              active={activeKey === "wdsf-profile"}
              accent={C.gold}
              badge={0}
              icon={<MedalIcon color={activeKey === "wdsf-profile" ? "#fff" : T.t2} size={20} />}
              onPress={() => navigate("/wdsf-profile")}
            />
          ) : null}
          {wdsfLinked ? (
            <NavItem
              label={lang.nav.rating}
              active={activeKey === "rating"}
              accent={C.accent}
              badge={0}
              icon={<RatingIcon color={activeKey === "rating" ? "#fff" : T.t2} size={20} />}
              onPress={() => navigate("/rating")}
            />
          ) : null}
          <NavItem
            label={lang.nav.leaderboard}
            active={activeKey === "leaderboard"}
            accent={C.purple}
            badge={0}
            icon={<LeaderboardIcon color={activeKey === "leaderboard" ? "#fff" : T.t2} size={20} />}
            onPress={() => navigate("/leaderboard")}
          />
          <NavItem
            label={lang.nav.manualAnalysis}
            active={activeKey === "manual-analysis"}
            accent={C.gold}
            badge={0}
            icon={<AnalyzeIcon color={activeKey === "manual-analysis" ? "#fff" : T.t2} size={20} />}
            onPress={() => navigate("/manual-analysis")}
          />
          {NAV_SECONDARY.map(({ key, href, icon: Icon, accent }) => {
            const active = key === activeKey;
            return (
              <NavItem
                key={key}
                label={navLabels[key] ?? key}
                active={active}
                accent={accent}
                badge={0}
                icon={<Icon color={active ? "#fff" : T.t2} size={20} />}
                onPress={() => navigate(href)}
              />
            );
          })}
        </View>

        <View style={s.spacer} />

        {/* ── Sign out ── */}
        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [s.logoutBtn, pressed && { opacity: 0.7 }]}
        >
          <LogoutIcon color={T.red} size={20} />
          <Text style={s.logoutText}>{lang.nav.signOut}</Text>
        </Pressable>

      </Animated.View>
    </View>
  );
}

// Map an item's accent to its matching gradient so each active pill keeps its
// identity (gold for Events/WDSF, purple for Calendar/About, brand otherwise).
function gradientFor(accent: string): readonly [string, string, ...string[]] {
  if (accent === C.gold)   return GRADIENTS.gold;
  if (accent === C.purple) return GRADIENTS.purple;
  return GRADIENTS.brand;
}

// ── Reusable nav item ────────────────────────────────────────────────────────
function NavItem({
  label, active, accent, badge, icon, onPress,
}: {
  label: string; active: boolean; accent: string; badge: number; icon: React.ReactNode; onPress: () => void;
}) {
  const T = useC();
  const s = useMemo(() => makeStyles(T), [T]);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.navItem,
        active && { backgroundColor: accent, shadowColor: accent, shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
        !active && pressed && s.navItemPressed,
      ]}
    >
      {active ? (
        <LinearGradient
          colors={gradientFor(accent)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 15 }]}
        />
      ) : null}
      {icon}
      <Text style={[s.navLabel, active && s.navLabelActive]}>{label}</Text>
      {badge > 0 ? (
        <View style={s.badge}>
          <Text style={s.badgeText}>{badge > 9 ? "9+" : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
  backdropFill: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  panel: {
    position: "absolute",
    top: 0, left: 0, bottom: 0,
    width: DRAWER_W,
    backgroundColor: "rgba(20,14,16,0.38)",
    overflow: "hidden",
    borderRightWidth: 1,
    borderRightColor: C.borderStrong,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 32,
    shadowOffset: { width: 12, height: 0 },
    elevation: 20,
  },

  // User card
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 4,
    marginBottom: 22,
  },
  avatarWrap: {
    position: "relative",
    width: 52,
    height: 52,
  },
  avatarGlow: {
    position: "absolute",
    top: -6,
    right: -6,
    bottom: -6,
    left: -6,
    borderRadius: 32,
    backgroundColor: C.accentGlow,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.elevated,
    borderWidth: 2,
    borderColor: C.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: C.accent,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  userInfo: { flex: 1 },
  userName: {
    color: C.t1,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginBottom: 3,
  },
  userEmail: {
    color: C.t3,
    fontSize: 12,
    fontWeight: "500",
  },

  divider: {
    height: 1,
    backgroundColor: C.border,
    marginBottom: 18,
    marginHorizontal: 4,
  },

  // Nav groups
  navGroup: { gap: 2, marginBottom: 4 },
  navGroupLabel: {
    color: C.t3,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.4,
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 15,
  },
  navItemPressed: {
    backgroundColor: C.elevated,
  },
  navLabel: {
    flex: 1,
    color: C.t2,
    fontSize: 15,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  navLabelActive: { color: "#fff" },

  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.red,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },

  spacer: { flex: 1 },

  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 15,
    backgroundColor: C.redFade,
    borderWidth: 1,
    borderColor: C.redBorder,
  },
  logoutText: {
    color: C.red,
    fontSize: 15,
    fontWeight: "600",
  },
  });
}
