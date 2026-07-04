import { useEffect } from "react";
import { Stack, router } from "expo-router";
import { connectSync, disconnectSync } from "../../lib/syncSocket";
import { registerForPush, addChatNotificationListener } from "../../lib/pushNotifications";
import { useChatStore } from "../../store/useChatStore";
import { useWdsfStore } from "../../store/useWdsfStore";
import Toast from "../../components/Toast";
import { useC } from "../../lib/useTheme";

export default function AppLayout() {
  const C = useC();

  // Start real-time partner sync when the user is authenticated (this layout
  // only mounts after successful login/hydration). Clean up on sign-out.
  useEffect(() => {
    connectSync();
    registerForPush();
    // Prime the chat unread badge.
    useChatStore.getState().fetch();
    // Prime WDSF link state so the side-menu shortcut shows on app start.
    useWdsfStore.getState().fetchProfile();

    // Tapping a push notification opens the couple chat. No-ops in Expo Go / web.
    const removeChatListener = addChatNotificationListener(() => router.push("/chat"));

    return () => {
      disconnectSync();
      removeChatListener();
    };
  }, []);

  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: C.bg },
          headerTintColor: C.t1,
          contentStyle: { backgroundColor: C.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="project/[id]" options={{ title: "Project" }} />
        <Stack.Screen name="rating" options={{ title: "Rating" }} />
        <Stack.Screen name="leaderboard" options={{ title: "Leaderboard" }} />
        <Stack.Screen name="manual-analysis" options={{ title: "Manual Analysis" }} />
        <Stack.Screen name="about-app" options={{ title: "About Floorcraft" }} />
        <Stack.Screen name="chat" options={{ title: "Chat" }} />
      </Stack>
      <Toast />
    </>
  );
}
