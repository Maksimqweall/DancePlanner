import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { api } from "./api";

// IMPORTANT: never `import * as Notifications from "expo-notifications"` at the top
// level. In Expo Go on Android (SDK 53+ removed remote push), that module THROWS at
// *import* time — which makes any route that pulls it in evaluate to `undefined`
// and surfaces as "Cannot read property 'ErrorBoundary' of undefined" / "missing
// default export". So we lazy-`require` it and bail cleanly when it isn't available
// (Expo Go, web). Push just no-ops there; the rest of the app still loads.
type NotificationsModule = typeof import("expo-notifications");

const isExpoGo = Constants.executionEnvironment === "storeClient";

function loadNotifications(): NotificationsModule | null {
  if (isExpoGo || Platform.OS === "web") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("expo-notifications") as NotificationsModule;
  } catch {
    return null;
  }
}

// Show notifications while the app is foregrounded too. Runs once, lazily, only
// where expo-notifications is actually usable.
let handlerConfigured = false;
function ensureHandler(N: NotificationsModule): void {
  if (handlerConfigured) return;
  handlerConfigured = true;
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

let registeredToken: string | null = null;

/**
 * Ask for permission, obtain the Expo push token and register it with the API.
 * Best-effort: silently no-ops on simulators, when permission is denied, or in
 * Expo Go / web (remote push needs a dev or standalone build).
 */
export async function registerForPush(): Promise<void> {
  const N = loadNotifications();
  if (!N) return;
  try {
    ensureHandler(N);
    if (!Device.isDevice) return;

    if (Platform.OS === "android") {
      await N.setNotificationChannelAsync("default", {
        name: "Default",
        importance: N.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const existing = await N.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      const req = await N.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== "granted") return;

    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
      (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;

    const tokenData = await N.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenData.data;
    if (!token || token === registeredToken) return;

    registeredToken = token;
    await api.post("/push/register", { token, platform: Platform.OS });
  } catch {
    // Push not available in this environment — ignore.
  }
}

/**
 * Register a "tap notification → open chat" handler. Safe no-op where
 * expo-notifications isn't available (Expo Go / web). Returns a cleanup fn.
 */
export function addChatNotificationListener(onChat: () => void): () => void {
  const N = loadNotifications();
  if (!N) return () => {};
  try {
    ensureHandler(N);
    const sub = N.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { type?: string } | undefined;
      if (data?.type === "chat") onChat();
    });
    return () => sub.remove();
  } catch {
    return () => {};
  }
}

export async function unregisterPush(): Promise<void> {
  try {
    if (!registeredToken) return;
    await api.post("/push/unregister", { token: registeredToken });
    registeredToken = null;
  } catch {
    // best-effort
  }
}
