// @ts-ignore
import "../global.css";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { useAuthStore } from "../store/useAuthStore";
import { useOnboardingStore } from "../store/useOnboardingStore";
import { useC } from "../lib/useTheme";
import { FONT_ASSETS, installTypography } from "../lib/typography";
import SplashScreen from "../components/SplashScreen";

// Apply the Plus Jakarta Sans typography globally as soon as this module loads.
installTypography();

export default function RootLayout() {
  const [fontsLoaded] = useFonts(FONT_ASSETS);
  const status              = useAuthStore((s) => s.status);
  const user                = useAuthStore((s) => s.user);
  const hydrate             = useAuthStore((s) => s.hydrate);
  const hasSeenOnboarding   = useOnboardingStore((s) => s.hasSeenOnboarding);
  const router   = useRouter();
  const segments = useSegments();
  const C        = useC();
  const statusBarStyle = "light" as const;

  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    if (!splashDone || status === "loading") return;
    const group  = segments[0];
    const inAuth = group === "(auth)";

    if (status === "unauthenticated") {
      if (!inAuth) router.replace("/login");
      return;
    }

    // Authenticated. New accounts must accept the Privacy Policy before anything else.
    if (user != null && !user.privacyAccepted) {
      if (group !== "privacy-policy") router.replace("/privacy-policy");
      return;
    }

    // Then the one-time onboarding tour.
    if (!hasSeenOnboarding) {
      if (group !== "onboarding") router.replace("/onboarding");
      return;
    }

    // Fully set up — don't linger on a gate screen.
    if (inAuth || group === "privacy-policy" || group === "onboarding") {
      router.replace("/");
    }
  }, [splashDone, status, segments, router, hasSeenOnboarding, user]);

  // Show animated splash until it finishes AND the premium fonts are ready, so the
  // first painted screen is already in Plus Jakarta Sans (no flash of system font).
  if (!splashDone || !fontsLoaded) {
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
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="privacy-policy" />
      </Stack>
    </>
  );
}
