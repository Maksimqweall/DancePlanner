import { useEffect } from "react";
import { Stack, router } from "expo-router";
import * as Notifications from "expo-notifications";
import { connectSync, disconnectSync } from "../../lib/syncSocket";
import { registerForPush } from "../../lib/pushNotifications";
import { useChatStore } from "../../store/useChatStore";
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

    // Tapping a push notification opens the couple chat.
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { type?: string } | undefined;
      if (data?.type === "chat") router.push("/chat");
    });

    return () => {
      disconnectSync();
      sub.remove();
    };
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
      <Stack.Screen name="chat" options={{ title: "Chat" }} />
    </Stack>
  );
}
