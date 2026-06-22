import { useEffect } from "react";
import { Stack } from "expo-router";
import { connectSync, disconnectSync } from "../../lib/syncSocket";

export default function AppLayout() {
  // Start real-time partner sync when the user is authenticated (this layout
  // only mounts after successful login/hydration). Clean up on sign-out.
  useEffect(() => {
    connectSync();
    return () => disconnectSync();
  }, []);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: "#18181b" },
        headerTintColor: "#fff",
        contentStyle: { backgroundColor: "#18181b" },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="project/[id]" options={{ title: "Project" }} />
      <Stack.Screen name="wdsf-profile" options={{ title: "WDSF Profile" }} />
    </Stack>
  );
}
