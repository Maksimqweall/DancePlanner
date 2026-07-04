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
import { Ionicons } from "@expo/vector-icons";
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
// Font-glyph icons (not react-native-svg): on Android's Fabric renderer, a raw
// <Svg> as a flex sibling of <Text> makes the sibling label render blank. A
// font glyph is itself a <Text>, so it can never break the row's layout.
function HomeIcon({ color, size = 20 }: { color: string; size?: number }) {
  return <Ionicons name="home-outline" size={size} color={color} />;
}
function CalendarIcon({ color, size = 20 }: { color: string; size?: number }) {
  return <Ionicons name="calendar-outline" size={size} color={color} />;
}
function WalletIcon({ color, size = 20 }: { color: string; size?: number }) {
  return <Ionicons name="wallet-outline" size={size} color={color} />;
}
function TrophyIcon({ color, size = 20 }: { color: string; size?: number }) {
  return <Ionicons name="trophy-outline" size={size} color={color} />;
}
function UsersIcon({ color, size = 20 }: { color: string; size?: number }) {
  return <Ionicons name="people-outline" size={size} color={color} />;
}
function InfoIcon({ color, size = 20 }: { color: string; size?: number }) {
  return <Ionicons name="information-circle-outline" size={size} color={color} />;
}
function RatingIcon({ color, size = 20 }: { color: string; size?: number }) {
  return <Ionicons name="star-outline" size={size} color={color} />;
}
function LeaderboardIcon({ color, size = 20 }: { color: string; size?: number }) {
  return <Ionicons name="podium-outline" size={size} color={color} />;
}
function AnalyzeIcon({ color, size = 20 }: { color: string; size?: number }) {
  return <Ionicons name="clipboard-outline" size={size} color={color} />;
}
function LogoutIcon({ color, size = 20 }: { color: string; size?: number }) {
  return <Ionicons name="log-out-outline" size={size} color={color} />;
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
  const [logoutPressed, setLogoutPressed] = React.useState(false);

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
        {Platform.OS === "ios" ? (
          <BlurView intensity={50} tint="dark" style={StyleSheet.absoluteFill} />
        ) : null}

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
                icon={<Icon color={active ? "#fff" : T.t2} size={26} />}
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
              label={lang.nav.rating}
              active={activeKey === "rating"}
              accent={C.accent}
              badge={0}
              icon={<RatingIcon color={activeKey === "rating" ? "#fff" : T.t2} size={26} />}
              onPress={() => navigate("/rating")}
            />
          ) : null}
          <NavItem
            label={lang.nav.leaderboard}
            active={activeKey === "leaderboard"}
            accent={C.purple}
            badge={0}
            icon={<LeaderboardIcon color={activeKey === "leaderboard" ? "#fff" : T.t2} size={26} />}
            onPress={() => navigate("/leaderboard")}
          />
          <NavItem
            label={lang.nav.manualAnalysis}
            active={activeKey === "manual-analysis"}
            accent={C.gold}
            badge={0}
            icon={<AnalyzeIcon color={activeKey === "manual-analysis" ? "#fff" : T.t2} size={26} />}
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
                icon={<Icon color={active ? "#fff" : T.t2} size={26} />}
                onPress={() => navigate(href)}
              />
            );
          })}
        </View>

        <View style={s.spacer} />

        {/* ── Sign out ── */}
        <Pressable
          onPress={handleLogout}
          onPressIn={() => setLogoutPressed(true)}
          onPressOut={() => setLogoutPressed(false)}
          style={[s.logoutBtn, logoutPressed && { opacity: 0.7 }]}
        >
          <View style={s.navIconWrapper}><LogoutIcon color={T.red} size={26} /></View>
          <View style={s.navTextWrapper}>
            <Text style={s.logoutText}>{lang.nav.signOut}</Text>
          </View>
        </Pressable>

      </Animated.View>
    </View>
  );
}

function gradientFor(accent: string): readonly [string, string, ...string[]] {
  if (accent === C.gold)   return GRADIENTS.gold;
  if (accent === C.purple) return GRADIENTS.purple;
  return GRADIENTS.brand;
}

function NavItem({
  label, active, accent, badge, icon, onPress,
}: {
  label: string; active: boolean; accent: string; badge: number; icon: React.ReactNode; onPress: () => void;
}) {
  const T = useC();
  const s = useMemo(() => makeStyles(T), [T]);
  const [pressed, setPressed] = React.useState(false);
  // Pressable's function-as-style prop (`style={({pressed}) => [...]}`) makes this
  // row's children (icon/label Text) render blank on Android — confirmed via a
  // side-by-side debug matrix (a plain View with a static style renders fine; every
  // Pressable variant using the function form, with or without the LinearGradient
  // sibling, collapsed). Tracking `pressed` via state and passing a static style
  // array avoids the function form entirely.
  const itemStyle = [
    s.navItem,
    active && { backgroundColor: accent, shadowColor: accent, shadowOpacity: 0.45, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
    !active && pressed && s.navItemPressed,
  ];
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={itemStyle}
    >
      {active ? (
        <LinearGradient
          colors={gradientFor(accent)}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.navItemGradient}
        />
      ) : null}
      <View style={s.navIconWrapper}>{icon}</View>
      <View style={s.navTextWrapper}>
        <Text style={[s.navLabel, active && s.navLabelActive]}>{label}</Text>
      </View>
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
    backgroundColor: "rgba(17,12,13,0.97)",
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
  navGroup: { gap: 6, marginBottom: 8 },
  navGroupLabel: {
    color: C.t3,
    fontSize: 11,
    fontWeight: "bold",
    letterSpacing: 1.5,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    height: 56,
    paddingLeft: 16,
    paddingRight: 16,
    marginBottom: 4,
    borderRadius: 16,
  },
  navItemGradient: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 16,
  },
  navItemPressed: {
    backgroundColor: C.elevated,
  },
  navIconWrapper: {
    width: 40,
    height: 40,
    alignItems: "flex-start",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.01)",
    zIndex: 1,
  },
  navTextWrapper: {
    flex: 1,
    justifyContent: "center",
    minWidth: 0,
    backgroundColor: "rgba(255,255,255,0.01)",
    zIndex: 1,
  },
  navLabel: {
    color: C.t2,
    fontSize: 15,
    fontWeight: "600",
    includeFontPadding: false,
  },
  navLabelActive: { 
    color: "#fff" 
  },

  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.red,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    marginLeft: 8,
    zIndex: 1,
  },
  badgeText: { color: "#fff", fontSize: 10, fontWeight: "800" },

  spacer: { flex: 1 },

  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: C.redFade,
    borderWidth: 1,
    borderColor: C.redBorder,
    minHeight: 56,
  },
  logoutText: {
    color: C.red,
    fontSize: 16,
    fontWeight: "700",
  },
  });
}
