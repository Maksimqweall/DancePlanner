import { useColorScheme } from "react-native";
import { useThemeStore } from "../store/useThemeStore";
import { LIGHT, DARK, type Palette } from "./theme";

// Returns the active palette, reacting to the user's theme preference
// (and the OS scheme when set to "system"). Components build their styles
// from this so they re-render on theme change.
export function useC(): Palette {
  const mode = useThemeStore((s) => s.mode);
  const system = useColorScheme();
  const resolved = mode === "system" ? (system ?? "dark") : mode;
  return resolved === "light" ? LIGHT : DARK;
}

// Convenience for components that need to know the resolved scheme
// (e.g. status bar style, gradient stops).
export function useScheme(): "light" | "dark" {
  const mode = useThemeStore((s) => s.mode);
  const system = useColorScheme();
  const resolved = mode === "system" ? (system ?? "dark") : mode;
  return resolved === "light" ? "light" : "dark";
}
