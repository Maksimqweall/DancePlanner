import { DARK, type Palette } from "./theme";

// The app is dark-only — the warm neon palette doesn't translate to a light
// surface, so there's no theme toggle. These hooks stay in place so screens
// don't need call-site changes if that ever changes again.
export function useC(): Palette {
  return DARK;
}

export function useScheme(): "dark" {
  return "dark";
}
