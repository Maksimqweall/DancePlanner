import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { api } from "./api";

// Show notifications while the app is foregrounded too.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

let registeredToken: string | null = null;

/**
 * Ask for permission, obtain the Expo push token and register it with the API.
 * Best-effort: silently no-ops on simulators, when permission is denied, or in
 * Expo Go (remote push needs a dev/standalone build).
 */
export async function registerForPush(): Promise<void> {
  try {
    if (!Device.isDevice) return;

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "Default",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== "granted") {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== "granted") return;

    const projectId =
      (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
      (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId;

    const tokenData = await Notifications.getExpoPushTokenAsync(
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

export async function unregisterPush(): Promise<void> {
  try {
    if (!registeredToken) return;
    await api.post("/push/unregister", { token: registeredToken });
    registeredToken = null;
  } catch {
    // best-effort
  }
}
