import React, { useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useSegments } from "expo-router";
import Svg, { Path, Rect, Circle, Line } from "react-native-svg";
import { C, SPRING } from "../lib/theme";
import { useDrawer } from "../lib/DrawerContext";
import { useAuthStore } from "../store/useAuthStore";
import { usePartnerStore } from "../store/usePartnerStore";
import type { Href } from "expo-router";

const DRAWER_W = 285;

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
function LogoutIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M9 21H5C4.47 21 3.96 20.79 3.59 20.41C3.21 20.04 3 19.53 3 19V5C3 4.47 3.21 3.96 3.59 3.59C3.96 3.21 4.47 3 5 3H9" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M16 17L21 12L16 7" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="21" y1="12" x2="9" y2="12" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
    </Svg>
  );
}

// ── Nav config ───────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { key: "index",    label: "Dashboard", href: "/",          icon: HomeIcon },
  { key: "calendar", label: "Calendar",  href: "/calendar",  icon: CalendarIcon },
  { key: "expenses", label: "Finance",   href: "/expenses",  icon: WalletIcon },
  { key: "projects", label: "Events",    href: "/projects",  icon: TrophyIcon },
  { key: "partner",  label: "Partner",   href: "/partner",   icon: UsersIcon },
] as const;

// ── Component ─────────────────────────────────────────────────────────────────
export default function SideDrawer() {
  const { isOpen, close } = useDrawer();
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const pendingCount = usePartnerStore((s) => s.pendingCount);

  const translateX = useSharedValue(-DRAWER_W - 20);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (isOpen) {
      translateX.value = withSpring(0, { damping: 22, stiffness: 260, mass: 0.8 });
      backdropOpacity.value = withTiming(1, { duration: 220 });
    } else {
      translateX.value = withSpring(-DRAWER_W - 20, { damping: 22, stiffness: 260, mass: 0.8 });
      backdropOpacity.value = withTiming(0, { duration: 180 });
    }
  }, [isOpen]);

  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  // Detect active tab from route segments
  const lastSeg = segments[segments.length - 1];
  const activeKey = lastSeg === "(tabs)" || lastSeg === "(app)" ? "index" : lastSeg;

  const navigate = (href: string) => {
    close();
    router.navigate(href as Href);
  };

  const handleLogout = () => {
    close();
    logout();
  };

  const initials =
    (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "");

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={isOpen ? "auto" : "none"}>
      {/* Backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close}>
          <View style={styles.backdropFill} />
        </Pressable>
      </Animated.View>

      {/* Slide panel */}
      <Animated.View
        style={[
          styles.panel,
          panelStyle,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
        ]}
      >
        {/* User header */}
        <View style={styles.userRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials || "?"}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName} numberOfLines={1}>
              {user?.firstName} {user?.lastName}
            </Text>
            <Text style={styles.userEmail} numberOfLines={1}>
              {user?.email}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Nav items */}
        <View style={styles.nav}>
          {NAV_ITEMS.map(({ key, label, href, icon: Icon }) => {
            const active = key === activeKey;
            const badge = key === "partner" && pendingCount > 0;
            return (
              <Pressable
                key={key}
                onPress={() => navigate(href)}
                style={({ pressed }) => [
                  styles.navItem,
                  active && styles.navItemActive,
                  pressed && !active && styles.navItemPressed,
                ]}
              >
                <Icon color={active ? "#fff" : C.t2} size={20} />
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                  {label}
                </Text>
                {badge ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {pendingCount > 9 ? "9+" : pendingCount}
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.spacer} />

        {/* Logout */}
        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [styles.logoutBtn, pressed && { opacity: 0.7 }]}
        >
          <LogoutIcon color={C.red} size={20} />
          <Text style={styles.logoutText}>Sign out</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdropFill: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  panel: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: DRAWER_W,
    backgroundColor: C.card,
    borderRightWidth: 1,
    borderRightColor: C.border,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 24,
    shadowOffset: { width: 8, height: 0 },
    elevation: 16,
  },
  // User header
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
    paddingHorizontal: 4,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.accentFade,
    borderWidth: 1.5,
    borderColor: C.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: C.accent,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  userInfo: { flex: 1 },
  userName: {
    color: C.t1,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  userEmail: {
    color: C.t3,
    fontSize: 12,
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginBottom: 12,
    marginHorizontal: 4,
  },
  // Nav
  nav: { gap: 2 },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  navItemActive: {
    backgroundColor: C.accent,
  },
  navItemPressed: {
    backgroundColor: C.elevated,
  },
  navLabel: {
    flex: 1,
    color: C.t2,
    fontSize: 15,
    fontWeight: "600",
  },
  navLabelActive: {
    color: "#fff",
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.red,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
  },
  spacer: { flex: 1 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: C.redFade,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.2)",
  },
  logoutText: {
    color: C.red,
    fontSize: 15,
    fontWeight: "600",
  },
});
