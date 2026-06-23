import { useEffect } from "react";
import { Stack } from "expo-router";
import { connectSync, disconnectSync } from "../../lib/syncSocket";
import { useC } from "../../lib/useTheme";

export default function AppLayout() {
  const C = useC();

  // Start real-time partner sync when the user is authenticated (this layout
  // only mounts after successful login/hydration). Clean up on sign-out.
  useEffect(() => {
    connectSync();
    return () => disconnectSync();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: C.bg },
        headerTintColor: C.t1,
        contentStyle: { backgroundColor: C.bg },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="project/[id]" options={{ title: "Project" }} />
      <Stack.Screen name="wdsf-profile" options={{ title: "WDSF Profile" }} />
      <Stack.Screen name="about-app" options={{ title: "About Dance Planner" }} />
    </Stack>
  );
}
