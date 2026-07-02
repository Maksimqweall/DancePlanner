import { Pressable, View, Text, StyleSheet, Platform } from "react-native";
import { Tabs, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import Svg, { Path, Rect, Circle } from "react-native-svg";
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs";
import { DrawerProvider, useDrawer } from "../../../lib/DrawerContext";
import SideDrawer from "../../../components/SideDrawer";
import { useAuthStore } from "../../../store/useAuthStore";
import { C } from "../../../lib/theme";
import { useC } from "../../../lib/useTheme";
import { useT } from "../../../lib/i18n";

function HomeIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 12L12 3L21 12V21H15V15H9V21H3V12Z" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
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
function TrophyIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8 21H16M12 17V21M8.5 4H15.5L14 12C14 14.2 13.1 17 12 17C10.9 17 10 14.2 10 12L8.5 4Z" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <Path d="M8.5 5H5V9C5 10.7 6.3 12 8 12M15.5 5H19V9C19 10.7 17.7 12 16 12" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
function MedalIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M8.5 3L11 8.5M15.5 3L13 8.5" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
      <Circle cx="12" cy="15" r="6" stroke={color} strokeWidth="1.75" />
      <Path d="M12 12.2L13 14.3L15.3 14.6L13.6 16.2L14 18.5L12 17.4L10 18.5L10.4 16.2L8.7 14.6L11 14.3L12 12.2Z" fill={color} />
    </Svg>
  );
}
function GearIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.75" />
      <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const TAB_META: Record<string, { label: string; accent: string }> = {
  index:         { label: "Home",     accent: C.accent },
  calendar:      { label: "Calendar", accent: C.purple },
  projects:      { label: "Events",   accent: C.gold   },
  "wdsf-profile": { label: "Profile", accent: C.gold   },
};

// Only these routes get a bottom-tab button — Finance, Partner and Settings
// stay reachable from the side drawer / header only (fewer tabs, iOS-style).
const VISIBLE_TABS = ["index", "calendar", "projects", "wdsf-profile"];

function TabIcon({ name, color, size }: { name: string; color: string; size: number }) {
  switch (name) {
    case "index":         return <HomeIcon color={color} size={size} />;
    case "calendar":      return <CalendarIcon color={color} size={size} />;
    case "projects":      return <TrophyIcon color={color} size={size} />;
    case "wdsf-profile":  return <MedalIcon color={color} size={size} />;
    default:              return null;
  }
}

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const T = useC();
  const t = useT();
  const tabLabels: Record<string, string> = {
    index:         t.nav.dashboard,
    calendar:      t.nav.calendar,
    projects:      t.nav.events,
    "wdsf-profile": t.nav.wdsfProfile,
  };

  const visibleRoutes = state.routes.filter((route: { name: string }) => VISIBLE_TABS.includes(route.name));

  return (
    <View style={[tb.bar, { borderTopColor: "rgba(255,255,255,0.18)", paddingBottom: Math.max(insets.bottom, 10) }]}>
      <BlurView
        intensity={Platform.OS === "web" ? 0 : 55}
        tint="dark"
        experimentalBlurMethod="dimezisBlurView"
        style={StyleSheet.absoluteFill}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(20,14,16,0.55)" }]} />
      <View style={tb.inner}>
        {visibleRoutes.map((route: { key: string; name: string; params?: object }) => {
          const index = state.routes.findIndex((r: { key: string }) => r.key === route.key);
          const isFocused = state.index === index;
          const meta = TAB_META[route.name] ?? { label: route.name, accent: C.accent };
          const color = isFocused ? meta.accent : T.t3;
          const tabLabel = tabLabels[route.name] ?? meta.label;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={tb.tab}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
            >
              <View style={tb.iconWrap}>
                {isFocused ? (
                  <LinearGradient
                    colors={[`${meta.accent}33`, `${meta.accent}0D`]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0, y: 1 }}
                    style={[StyleSheet.absoluteFill, { borderRadius: 14 }]}
                  />
                ) : null}
                <TabIcon name={route.name} color={color} size={22} />
              </View>
              <Text style={[tb.label, { color }]}>{tabLabel}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function AvatarButton({ onPress }: { onPress: () => void }) {
  const user = useAuthStore((s) => s.user);
  const T = useC();
  const initials = (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "");
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [s.avatarBtn, pressed && { opacity: 0.65 }]}
      hitSlop={10}
    >
      <View style={[s.avatarCircle, { backgroundColor: T.elevated, borderColor: T.accentBorder }]}>
        <Text style={[s.avatarInitials, { color: T.accent }]}>{initials || "?"}</Text>
      </View>
    </Pressable>
  );
}

function SettingsButton() {
  const T = useC();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/about")}
      style={({ pressed }) => [s.settingsBtn, pressed && { opacity: 0.65 }]}
      hitSlop={10}
    >
      <View style={[s.settingsCircle, { backgroundColor: T.elevated, borderColor: T.border }]}>
        <GearIcon color={T.t2} size={17} />
      </View>
    </Pressable>
  );
}

function TabsLayoutInner() {
  const { open } = useDrawer();
  const T = useC();
  const t = useT();

  return (
    <View style={[s.root, { backgroundColor: T.bg }]}>
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerStyle:         { backgroundColor: T.bg },
          headerTintColor:     T.t1,
          headerShadowVisible: false,
          headerTitleStyle:    { fontWeight: "700", fontSize: 18, color: T.t1 },
          headerLeft:          () => <AvatarButton onPress={open} />,
          headerRight:         () => <SettingsButton />,
          sceneStyle:          { backgroundColor: T.bg },
        }}
      >
        <Tabs.Screen name="index"         options={{ title: t.nav.dashboard }} />
        <Tabs.Screen name="calendar"      options={{ title: t.nav.calendar  }} />
        <Tabs.Screen name="projects"      options={{ title: t.nav.events    }} />
        <Tabs.Screen name="wdsf-profile"  options={{ title: t.nav.wdsfProfile }} />
        <Tabs.Screen name="expenses"      options={{ title: t.nav.finance, href: null }} />
        <Tabs.Screen name="partner"       options={{ title: t.nav.partner, href: null }} />
        <Tabs.Screen name="about"         options={{ title: t.settings.title, href: null }} />
      </Tabs>
      <SideDrawer />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <DrawerProvider>
      <TabsLayoutInner />
    </DrawerProvider>
  );
}

const s = StyleSheet.create({
  root:         { flex: 1, backgroundColor: C.bg },
  avatarBtn:    { marginLeft: 14 },
  avatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: C.elevated,
    borderWidth: 1.5,
    borderColor: C.accentBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: { color: C.accent, fontSize: 12, fontWeight: "800", letterSpacing: 0.5 },
  settingsBtn:    { marginRight: 14 },
  settingsCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

const tb = StyleSheet.create({
  bar: {
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 6,
    overflow: "hidden",
  },
  inner: { flexDirection: "row" },
  tab: {
    flex: 1,
    alignItems: "center",
    gap: 3,
    paddingTop: 2,
  },
  iconWrap: {
    width: 46,
    height: 34,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.1,
    marginBottom: 2,
  },
});
