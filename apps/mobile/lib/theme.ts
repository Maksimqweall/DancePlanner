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

// ── Dark — deep blue-black slate (Apple/Linear dark base) ────────────────────
export const DARK: Palette = {
  bg:       '#0D0E12',
  card:     '#16181F',
  elevated: '#1E2028',
  input:    '#191B24',

  border:       'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',

  accent:       '#6366F1',
  accentFade:   'rgba(99,102,241,0.14)',
  accentBorder: 'rgba(99,102,241,0.40)',
  accentGlow:   'rgba(99,102,241,0.22)',

  gold:       '#F59E0B',
  goldFade:   'rgba(245,158,11,0.14)',
  goldBorder: 'rgba(245,158,11,0.35)',
  goldGlow:   'rgba(245,158,11,0.20)',

  red:       '#EF4444',
  redFade:   'rgba(239,68,68,0.14)',
  redBorder: 'rgba(239,68,68,0.30)',

  purple:       '#A855F7',
  purpleFade:   'rgba(168,85,247,0.14)',
  purpleBorder: 'rgba(168,85,247,0.35)',
  purpleGlow:   'rgba(168,85,247,0.18)',

  t1: '#F0F0FF',
  t2: '#8888A8',
  t3: '#54546A',
};

// ── Light — airy off-white premium (matches the reference designs) ───────────
export const LIGHT: Palette = {
  bg:       '#F4F5F8',
  card:     '#FFFFFF',
  elevated: '#EEF0F4',
  input:    '#F0F1F5',

  border:       'rgba(20,22,45,0.08)',
  borderStrong: 'rgba(20,22,45,0.14)',

  accent:       '#6366F1',
  accentFade:   'rgba(99,102,241,0.10)',
  accentBorder: 'rgba(99,102,241,0.28)',
  accentGlow:   'rgba(99,102,241,0.16)',

  gold:       '#D97706',
  goldFade:   'rgba(245,158,11,0.14)',
  goldBorder: 'rgba(217,119,6,0.30)',
  goldGlow:   'rgba(245,158,11,0.18)',

  red:       '#DC2626',
  redFade:   'rgba(239,68,68,0.10)',
  redBorder: 'rgba(220,38,38,0.28)',

  purple:       '#9333EA',
  purpleFade:   'rgba(168,85,247,0.10)',
  purpleBorder: 'rgba(147,51,234,0.28)',
  purpleGlow:   'rgba(168,85,247,0.14)',

  t1: '#15171F',
  t2: '#5B5E70',
  t3: '#9A9DB0',
};

// Static default export — used by screens not yet migrated to the useC() hook.
// Keep as DARK so unconverted screens look exactly as before during the rollout.
export const C: Palette = DARK;

export const SPRING = {
  press:   { damping: 15, stiffness: 350, mass: 0.6 },
  pill:    { damping: 20, stiffness: 280, mass: 0.7 },
  gentle:  { damping: 22, stiffness: 200, mass: 0.8 },
  bouncy:  { damping: 10, stiffness: 200, mass: 0.5 },
  drawer:  { damping: 22, stiffness: 260, mass: 0.8 },
} as const;

// ── Signature gradients ──────────────────────────────────────────────────────
// The brand sweep (indigo → violet → purple) is the hero; the rest stay tonally
// close so the whole app feels cohesive. These read well on both light and dark
// backgrounds, so they're shared across palettes. Pass straight to
// <LinearGradient colors={GRADIENTS.brand} /> or the <GradientButton> primitive.
export const GRADIENTS = {
  brand:    ["#6366F1", "#8B5CF6", "#A855F7"],
  brandRev: ["#A855F7", "#8B5CF6", "#6366F1"],
  purple:   ["#7C3AED", "#A855F7", "#D946EF"],
  gold:     ["#F59E0B", "#FB923C", "#F97316"],
  success:  ["#10B981", "#34D399", "#6EE7B7"],
  sunset:   ["#6366F1", "#A855F7", "#EC4899"],
  rose:     ["#F43F5E", "#EC4899", "#D946EF"],
  ocean:    ["#0EA5E9", "#38BDF8", "#22D3EE"],
  aurora:   ["#6366F1", "#22D3EE", "#34D399"],
  ember:    ["#F43F5E", "#FB923C", "#F59E0B"],
  midnight: ["#312E81", "#4F46E5", "#7C3AED"],
} as const;

export type GradientName = keyof typeof GRADIENTS;

// Very-low-alpha sweeps for tinting card surfaces behind content (premium "frosted"
// depth without overpowering the text). Pair with a matching solid card under them.
export const SURFACE_TINTS = {
  brand:  ["rgba(99,102,241,0.10)", "rgba(168,85,247,0.04)", "transparent"],
  gold:   ["rgba(245,158,11,0.10)", "rgba(249,115,22,0.04)", "transparent"],
  purple: ["rgba(168,85,247,0.10)", "rgba(217,70,239,0.04)", "transparent"],
  ocean:  ["rgba(14,165,233,0.10)", "rgba(34,211,238,0.04)", "transparent"],
  rose:   ["rgba(244,63,94,0.10)", "rgba(236,72,153,0.04)", "transparent"],
} as const;

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
