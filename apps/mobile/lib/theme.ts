export const C = {
  // ── Backgrounds ────────────────────────────────────────────────────────────
  bg:       '#07070a',   // deep near-black with blue tint
  card:     '#0e0e14',   // card surface
  elevated: '#15151f',   // raised surfaces, modals
  input:    '#11111a',   // input fields

  // ── Borders ────────────────────────────────────────────────────────────────
  border:       'rgba(255,255,255,0.06)',
  borderStrong: 'rgba(255,255,255,0.12)',

  // ── Emerald (primary accent) ────────────────────────────────────────────────
  accent:       '#10b981',
  accentFade:   'rgba(16,185,129,0.12)',
  accentBorder: 'rgba(16,185,129,0.35)',
  accentGlow:   'rgba(16,185,129,0.22)',

  // ── Gold (premium / planned) ────────────────────────────────────────────────
  gold:       '#f59e0b',
  goldFade:   'rgba(245,158,11,0.12)',
  goldBorder: 'rgba(245,158,11,0.35)',
  goldGlow:   'rgba(245,158,11,0.20)',

  // ── Red (danger / debt) ────────────────────────────────────────────────────
  red:       '#ef4444',
  redFade:   'rgba(239,68,68,0.12)',
  redBorder: 'rgba(239,68,68,0.30)',

  // ── Purple (events / projects) ─────────────────────────────────────────────
  purple:       '#a855f7',
  purpleFade:   'rgba(168,85,247,0.15)',
  purpleBorder: 'rgba(168,85,247,0.35)',
  purpleGlow:   'rgba(168,85,247,0.18)',

  // ── Text ───────────────────────────────────────────────────────────────────
  t1: '#f0f0f8',   // primary
  t2: '#8e8ea0',   // secondary
  t3: '#44445a',   // disabled / hint
} as const;

export const SPRING = {
  press:   { damping: 15, stiffness: 350, mass: 0.6 },
  pill:    { damping: 20, stiffness: 280, mass: 0.7 },
  gentle:  { damping: 22, stiffness: 200, mass: 0.8 },
  bouncy:  { damping: 10, stiffness: 200, mass: 0.5 },
  drawer:  { damping: 22, stiffness: 260, mass: 0.8 },
} as const;
