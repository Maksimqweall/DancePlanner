// @ts-ignore
import "../global.css";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useAuthStore } from "../store/useAuthStore";
import { useC, useScheme } from "../lib/useTheme";
import SplashScreen from "../components/SplashScreen";

export default function RootLayout() {
  const status   = useAuthStore((s) => s.status);
  const hydrate  = useAuthStore((s) => s.hydrate);
  const router   = useRouter();
  const segments = useSegments();
  const C        = useC();
  const scheme   = useScheme();
  const statusBarStyle = scheme === "light" ? "dark" : "light";

  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    if (!splashDone || status === "loading") return;
    const inAuth = segments[0] === "(auth)";
    if (status === "unauthenticated" && !inAuth) router.replace("/login");
    else if (status === "authenticated" && inAuth)  router.replace("/");
  }, [splashDone, status, segments, router]);

  // Show animated splash until it finishes (hydration always completes within it)
  if (!splashDone) {
    return (
      <>
        <StatusBar style={statusBarStyle} />
        <SplashScreen onFinish={() => setSplashDone(true)} />
      </>
    );
  }

  // Brief blank while auth state resolves (rare — usually < 50 ms after splash)
  if (status === "loading") {
    return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  }

  return (
    <>
      <StatusBar style={statusBarStyle} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </>
  );
}
