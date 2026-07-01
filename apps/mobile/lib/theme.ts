// Premium theme palettes. Both light and dark share the SAME keys so any
// component can swap palettes at runtime via the useC() hook (see lib/useTheme).
export interface Palette {
  bg: string;
  card: string;
  elevated: string;
  input: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentFade: string;
  accentBorder: string;
  accentGlow: string;
  gold: string;
  goldFade: string;
  goldBorder: string;
  goldGlow: string;
  red: string;
  redFade: string;
  redBorder: string;
  purple: string;
  purpleFade: string;
  purpleBorder: string;
  purpleGlow: string;
  t1: string;
  t2: string;
  t3: string;
}

// ── Dark — warm charcoal base (never pure black — glow blobs do the rest) ───
// `card`/`elevated`/`input` are intentionally translucent (not solid hex): every
// plain surface in the app sits over <AppBackground/>'s neon glow, so a see-
// through tint is what makes a plain View read as "glass" without every call
// site needing to switch to <GlassCard/> + BlurView.
export const DARK: Palette = {
  bg:       '#1A1013',
  card:     'rgba(36,21,25,0.62)',
  elevated: 'rgba(44,26,31,0.66)',
  input:    'rgba(39,23,32,0.70)',

  border:       'rgba(255,255,255,0.10)',
  borderStrong: 'rgba(255,255,255,0.20)',

  accent:       '#FF5B2E',
  accentFade:   'rgba(255,91,46,0.14)',
  accentBorder: 'rgba(255,91,46,0.40)',
  accentGlow:   'rgba(255,91,46,0.25)',

  gold:       '#FFB020',
  goldFade:   'rgba(255,176,32,0.14)',
  goldBorder: 'rgba(255,176,32,0.35)',
  goldGlow:   'rgba(255,176,32,0.22)',

  red:       '#EF4444',
  redFade:   'rgba(239,68,68,0.14)',
  redBorder: 'rgba(239,68,68,0.30)',

  purple:       '#FF2D95',
  purpleFade:   'rgba(255,45,149,0.14)',
  purpleBorder: 'rgba(255,45,149,0.35)',
  purpleGlow:   'rgba(255,45,149,0.22)',

  t1: '#FFF3EC',
  t2: '#B09C98',
  t3: '#5C4E4C',
};

// App is dark-only — the warm neon palette is designed against a near-black
// surface and doesn't translate to a light background. No LIGHT palette.

// Static default export — used by screens not yet migrated to the useC() hook.
export const C: Palette = DARK;

export const SPRING = {
  press:   { damping: 15, stiffness: 350, mass: 0.6 },
  pill:    { damping: 20, stiffness: 280, mass: 0.7 },
  gentle:  { damping: 22, stiffness: 200, mass: 0.8 },
  bouncy:  { damping: 10, stiffness: 200, mass: 0.5 },
  drawer:  { damping: 22, stiffness: 260, mass: 0.8 },
} as const;

// ── Signature gradients ──────────────────────────────────────────────────────
// The brand sweep (orange → hot pink → magenta) is the hero; the rest stay
// tonally warm so the whole app reads as one bold, neon-premium product. These
// read well on both light and dark backgrounds, so they're shared across
// palettes. Pass straight to <LinearGradient colors={GRADIENTS.brand} /> or the
// <GradientButton> primitive.
export const GRADIENTS = {
  brand:    ["#FF7A18", "#FF3D68", "#C724B1"],
  brandRev: ["#C724B1", "#FF3D68", "#FF7A18"],
  purple:   ["#FF3D68", "#C724B1", "#7B2FF7"],
  gold:     ["#FFD200", "#FFA500", "#FF6A00"],
  success:  ["#10B981", "#34D399", "#6EE7B7"],
  sunset:   ["#FF512F", "#FF7A18", "#F9D423"],
  rose:     ["#FF0080", "#FF5F6D", "#FFC371"],
  ocean:    ["#0EA5E9", "#38BDF8", "#22D3EE"],
  aurora:   ["#FF3D68", "#FFA500", "#FFD200"],
  ember:    ["#F43F5E", "#FB923C", "#F59E0B"],
  midnight: ["#3B0764", "#7B2FF7", "#C724B1"],
} as const;

export type GradientName = keyof typeof GRADIENTS;

// Big, soft neon blobs painted behind every screen (see AppBackground) so the
// app never reads as flat black — there's always warm color glowing through,
// which is also what makes the Liquid-Glass panels on top look "glass".
export const GLOW_BLOBS = {
  top:    { color: "#FF5B2E", size: 420, opacity: 0.35 },
  bottom: { color: "#C724B1", size: 460, opacity: 0.30 },
  mid:    { color: "#FF2D95", size: 320, opacity: 0.22 },
} as const;

// Very-low-alpha sweeps for tinting card surfaces behind content (premium "frosted"
// depth without overpowering the text). Pair with a matching solid card under them.
export const SURFACE_TINTS = {
  brand:  ["rgba(255,122,24,0.10)", "rgba(199,36,177,0.04)", "transparent"],
  gold:   ["rgba(255,176,32,0.10)", "rgba(255,106,0,0.04)", "transparent"],
  purple: ["rgba(255,45,149,0.10)", "rgba(123,47,247,0.04)", "transparent"],
  ocean:  ["rgba(14,165,233,0.10)", "rgba(34,211,238,0.04)", "transparent"],
  rose:   ["rgba(255,0,128,0.10)", "rgba(255,95,109,0.04)", "transparent"],
} as const;

// ── Staircase stagger ────────────────────────────────────────────────────────
// The cascading "staircase" entrance used for list items and stacked sections:
// each row's delay grows by STAGGER_STEP ms, capped at STAGGER_MAX so long
// lists don't take forever to finish animating in.
export const STAGGER_STEP = 55;
export const STAGGER_MAX = 8;
export function stagger(index: number, step: number = STAGGER_STEP, max: number = STAGGER_MAX) {
  return Math.min(index, max) * step;
}

// ── Elevation / shadow system ────────────────────────────────────────────────
// Soft, modern shadows that read on both palettes. Spread these into a style.
// `glow()` makes a coloured halo for hero cards, CTAs and focused elements.
export const SHADOWS = {
  xs: { shadowColor: "#0A0A18", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.10, shadowRadius: 3, elevation: 2 },
  sm: { shadowColor: "#0A0A18", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.13, shadowRadius: 8, elevation: 4 },
  md: { shadowColor: "#0A0A18", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.17, shadowRadius: 18, elevation: 9 },
  lg: { shadowColor: "#0A0A18", shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.22, shadowRadius: 30, elevation: 16 },
} as const;

export function glow(color: string, radius = 22, opacity = 0.45) {
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: opacity,
    shadowRadius: radius,
    elevation: 12,
  };
}
