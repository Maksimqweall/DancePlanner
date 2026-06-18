import { Tabs } from "expo-router";
import TabBar from "../../../components/TabBar";
import { C } from "../../../lib/theme";

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...(props as any)} />}
      screenOptions={{
        headerStyle: { backgroundColor: C.bg },
        headerTintColor: C.t1,
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Dashboard" }} />
      <Tabs.Screen name="calendar" options={{ title: "Calendar" }} />
      <Tabs.Screen name="expenses" options={{ title: "Finance" }} />
      <Tabs.Screen name="projects" options={{ title: "Events" }} />
    </Tabs>
  );
}
