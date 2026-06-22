export const C = {
  // ── Backgrounds — deep blue-black slate (Apple/Linear dark base) ───────────
  bg:       '#0D0E12',
  card:     '#16181F',
  elevated: '#1E2028',
  input:    '#191B24',

  // ── Borders — steel tone ───────────────────────────────────────────────────
  border:       'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.16)',

  // ── Indigo (primary accent — Linear / premium tech) ────────────────────────
  accent:       '#6366F1',
  accentFade:   'rgba(99,102,241,0.12)',
  accentBorder: 'rgba(99,102,241,0.40)',
  accentGlow:   'rgba(99,102,241,0.22)',

  // ── Gold (financial / planned) ─────────────────────────────────────────────
  gold:       '#F59E0B',
  goldFade:   'rgba(245,158,11,0.12)',
  goldBorder: 'rgba(245,158,11,0.35)',
  goldGlow:   'rgba(245,158,11,0.20)',

  // ── Red (danger / debt) ────────────────────────────────────────────────────
  red:       '#EF4444',
  redFade:   'rgba(239,68,68,0.12)',
  redBorder: 'rgba(239,68,68,0.30)',

  // ── Violet (events / projects — distinct from indigo accent) ──────────────
  purple:       '#A855F7',
  purpleFade:   'rgba(168,85,247,0.12)',
  purpleBorder: 'rgba(168,85,247,0.35)',
  purpleGlow:   'rgba(168,85,247,0.18)',

  // ── Text ───────────────────────────────────────────────────────────────────
  t1: '#F0F0FF',   // primary — white with subtle blue cast
  t2: '#8888A8',   // secondary — blue-gray
  t3: '#44445A',   // hint / disabled
} as const;

export const SPRING = {
  press:   { damping: 15, stiffness: 350, mass: 0.6 },
  pill:    { damping: 20, stiffness: 280, mass: 0.7 },
  gentle:  { damping: 22, stiffness: 200, mass: 0.8 },
  bouncy:  { damping: 10, stiffness: 200, mass: 0.5 },
  drawer:  { damping: 22, stiffness: 260, mass: 0.8 },
} as const;
