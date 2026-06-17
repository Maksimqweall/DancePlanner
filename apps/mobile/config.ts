import { Platform } from "react-native";
import Constants from "expo-constants";

// Resolves the base URL of the DancePlanner API for the current runtime.
//
// - Web (expo start --web): the browser runs on the dev machine, so localhost works.
// - Device / emulator: reuse the Metro bundler host (your machine's LAN IP) and
//   point it at the API port. Make sure the phone is on the same network.
// - Override anytime with the EXPO_PUBLIC_API_URL env var.
const API_PORT = 4000;

function resolveApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  if (Platform.OS === "web") return `http://localhost:${API_PORT}`;

  const hostUri =
    Constants.expoConfig?.hostUri ??
    Constants.expoGoConfig?.debuggerHost ??
    "";
  const host = hostUri.split(":")[0];
  if (host) return `http://${host}:${API_PORT}`;

  return `http://localhost:${API_PORT}`;
}

export const API_BASE_URL = resolveApiBaseUrl();
