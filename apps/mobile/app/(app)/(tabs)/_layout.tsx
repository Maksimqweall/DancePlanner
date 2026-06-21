import { View, Pressable, StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { C } from "../../../lib/theme";
import { DrawerProvider, useDrawer } from "../../../lib/DrawerContext";
import SideDrawer from "../../../components/SideDrawer";

// Hamburger icon for the header
function MenuIcon({ color = C.t1, size = 22 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M3 6H21" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M3 12H21" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M3 18H15" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function HamburgerButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuBtn, pressed && { opacity: 0.6 }]}
      hitSlop={8}
    >
      <MenuIcon />
    </Pressable>
  );
}

// Thin safe-area spacer replaces the bottom tab bar
function BottomSpacer() {
  const insets = useSafeAreaInsets();
  return <View style={{ height: Math.max(insets.bottom, 8) }} />;
}

function TabsLayoutInner() {
  const { open } = useDrawer();
  const headerLeft = () => <HamburgerButton onPress={open} />;

  return (
    <View style={styles.root}>
      <Tabs
        tabBar={() => <BottomSpacer />}
        screenOptions={{
          headerStyle: { backgroundColor: C.bg },
          headerTintColor: C.t1,
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: "700", fontSize: 18 },
          headerLeft,
          sceneStyle: { backgroundColor: C.bg },
        }}
      >
        <Tabs.Screen name="index"    options={{ title: "Dashboard" }} />
        <Tabs.Screen name="calendar" options={{ title: "Calendar" }} />
        <Tabs.Screen name="expenses" options={{ title: "Finance" }} />
        <Tabs.Screen name="projects" options={{ title: "Events" }} />
        <Tabs.Screen name="partner"  options={{ title: "Partner" }} />
      </Tabs>

      {/* Side drawer overlays the entire tab area */}
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  menuBtn: { marginLeft: 16 },
});
