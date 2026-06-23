import { Pressable, View, Text, StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Rect, Circle } from "react-native-svg";
import type { BottomTabBarProps } from "expo-router/build/react-navigation/bottom-tabs";
import { DrawerProvider, useDrawer } from "../../../lib/DrawerContext";
import SideDrawer from "../../../components/SideDrawer";
import { useAuthStore } from "../../../store/useAuthStore";
import { usePartnerStore } from "../../../store/usePartnerStore";
import { C } from "../../../lib/theme";
import { useC } from "../../../lib/useTheme";

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
function WalletIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M2 7C2 5.9 2.9 5 4 5H20C21.1 5 22 5.9 22 7V17C22 18.1 21.1 19 20 19H4C2.9 19 2 18.1 2 17V7Z" stroke={color} strokeWidth="1.75" />
      <Path d="M2 10H22" stroke={color} strokeWidth="1.75" strokeLinecap="round" />
      <Circle cx="16.5" cy="14.5" r="1" fill={color} />
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
function GearIcon({ color, size = 22 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.75" />
      <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke={color} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const TAB_META: Record<string, { label: string; accent: string }> = {
  index:    { label: "Home",     accent: C.accent },
  calendar: { label: "Calendar", accent: C.purple },
  expenses: { label: "Finance",  accent: C.accent },
  projects: { label: "Events",   accent: C.gold   },
  partner:  { label: "Partner",  accent: C.accent },
  about:    { label: "Settings", accent: C.t2     },
};

function TabIcon({ name, color, size }: { name: string; color: string; size: number }) {
  switch (name) {
    case "index":    return <HomeIcon color={color} size={size} />;
    case "calendar": return <CalendarIcon color={color} size={size} />;
    case "expenses": return <WalletIcon color={color} size={size} />;
    case "projects": return <TrophyIcon color={color} size={size} />;
    case "partner":  return <UsersIcon color={color} size={size} />;
    case "about":    return <GearIcon color={color} size={size} />;
    default:         return null;
  }
}

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const pendingCount = usePartnerStore((s) => s.pendingCount);
  const T = useC();

  return (
    <View style={[tb.bar, { backgroundColor: T.card, borderTopColor: T.border, paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={tb.inner}>
        {state.routes.map((route: { key: string; name: string; params?: object }, index: number) => {
          const isFocused = state.index === index;
          const meta = TAB_META[route.name] ?? { label: route.name, accent: C.accent };
          const color = isFocused ? meta.accent : T.t3;
          const hasBadge = route.name === "partner" && pendingCount > 0;

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
              <View style={[tb.iconWrap, isFocused && { backgroundColor: `${meta.accent}18` }]}>
                <TabIcon name={route.name} color={color} size={22} />
                {hasBadge ? (
                  <View style={[tb.badge, { backgroundColor: T.red }]}>
                    <Text style={tb.badgeText}>{pendingCount > 9 ? "9+" : pendingCount}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[tb.label, { color }]}>{meta.label}</Text>
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

function TabsLayoutInner() {
  const { open } = useDrawer();
  const T = useC();

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
          sceneStyle:          { backgroundColor: T.bg },
        }}
      >
        <Tabs.Screen name="index"    options={{ title: "Dashboard" }} />
        <Tabs.Screen name="calendar" options={{ title: "Calendar"  }} />
        <Tabs.Screen name="expenses" options={{ title: "Finance"   }} />
        <Tabs.Screen name="projects" options={{ title: "Events"    }} />
        <Tabs.Screen name="partner"  options={{ title: "Partner"   }} />
        <Tabs.Screen name="about"    options={{ title: "Settings"  }} />
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
});

const tb = StyleSheet.create({
  bar: {
    backgroundColor: C.card,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 6,
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
  badge: {
    position: "absolute",
    top: 1,
    right: 1,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: C.red,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
});
