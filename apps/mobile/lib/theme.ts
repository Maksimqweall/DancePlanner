export const C = {
  bg: '#0a0a0b',
  card: '#141416',
  elevated: '#1d1d1f',
  input: '#1a1a1c',
  border: 'rgba(255,255,255,0.07)',
  accent: '#10b981',
  accentFade: 'rgba(16,185,129,0.14)',
  accentBorder: 'rgba(16,185,129,0.4)',
  gold: '#f59e0b',
  goldFade: 'rgba(245,158,11,0.14)',
  red: '#ef4444',
  redFade: 'rgba(239,68,68,0.14)',
  purple: '#a855f7',
  purpleFade: 'rgba(168,85,247,0.18)',
  purpleBorder: 'rgba(168,85,247,0.35)',
  t1: '#ffffff',
  t2: '#a1a1aa',
  t3: '#52525b',
} as const;

export const SPRING = {
  press: { damping: 15, stiffness: 350, mass: 0.6 },
  pill: { damping: 20, stiffness: 280, mass: 0.7 },
} as const;
