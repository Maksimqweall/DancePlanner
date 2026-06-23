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
