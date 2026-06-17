import { Tabs } from "expo-router";
import { Text, type ColorValue } from "react-native";

function TabIcon({ icon, color }: { icon: string; color: ColorValue }) {
  return <Text style={{ fontSize: 20, color }}>{icon}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: "#18181b" },
        headerTintColor: "#fff",
        tabBarStyle: { backgroundColor: "#18181b", borderTopColor: "#27272a" },
        tabBarActiveTintColor: "#10b981",
        tabBarInactiveTintColor: "#71717a",
        sceneStyle: { backgroundColor: "#18181b" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => <TabIcon icon="📊" color={color} />,
        }}
      />
      <Tabs.Screen
        name="expenses"
        options={{
          title: "Expenses",
          tabBarIcon: ({ color }) => <TabIcon icon="💶" color={color} />,
        }}
      />
      <Tabs.Screen
        name="projects"
        options={{
          title: "Projects",
          tabBarIcon: ({ color }) => <TabIcon icon="🏆" color={color} />,
        }}
      />
    </Tabs>
  );
}
