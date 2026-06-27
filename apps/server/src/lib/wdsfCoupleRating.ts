import {
  extractUuid,
  type WdsfProfile,
  type WdsfCompetition,
  type RankingEntry,
  type PrelimRound,
  type FinalResult,
  type Scores3Result,
  type Score3Round,
} from "./wdsfScraper";
import {
  computeTournamentRating,
  type Tier,
  type RankedCouple,
} from "./wdsfRanking";

// ─── Couple Rating (1–10) — TEST version ───────────────────────────────────────
//
// Produces a single 1–10 strength rating for a couple from its WDSF profile, plus
// a world rank and a regional rank. The region (country) is taken from the
// athlete's **Represents** field, NOT Nationality, per spec.
//
// Two tiers of signal feed the rating:
//   • Profile-level  — every result in the couple's history (places, dates, finals).
//   • Deep per-event — for the most recent events we additionally scrape the start
//     list + the World Ranking at that month and compute, for REAL:
//        - the tournament tier (S–D) via computeTournamentRating (field strength),
//        - upset wins  : couples the pair beat that were ranked ABOVE it,
//        - bad losses  : couples ranked BELOW it that finished AHEAD of it,
//        - round-1 exit: the pair was eliminated in the first round.
//
// The rating is a weighted blend of sub-scores (each 0..1) minus penalties. Weights
// follow the requested priority (strong > medium > trend). Everything is returned
// so the model can be inspected and tuned.

const WEIGHTS = {
  avgPlace: 0.3, // STRONG — average finishing place
  tier: 0.25, // STRONG — level of events usually danced (S–D, real when deep)
  worldStanding: 0.2, // STRONG — world-rank standing + upset wins vs higher-ranked
  finalsPodium: 0.15, // MEDIUM — finals & podiums
  trend: 0.1, // form trend (recent vs older placements)
} as const;

const MAX_COMPS = 40; // history depth feeding profile-level stats
const ASSUMED_FIELD = 30; // field-size assumption when an event omits the entry count
const UPSET_SATURATION = 12; // upset wins at which the upset signal maxes out

// Rating → tier bands (mirror of the tournament-rating model).
const RATING_BANDS: { tier: Exclude<Tier, "Unrated">; floor: number }[] = [
  { tier: "S", floor: 9 },
  { tier: "A", floor: 7 },
  { tier: "B", floor: 5 },
  { tier: "C", floor: 3 },
  { tier: "D", floor: 1 },
];

export interface CoupleRatingComponent {
  key: keyof typeof WEIGHTS;
  label: string;
  weight: number;
  score: number; // 0..1
  detail: string;
}

export interface CoupleRatingPenalty {
  key: string;
  label: string;
  amount: number; // points subtracted from the 0..10 base
  detail: string;
}

/** Fully-resolved signals for one recent event (real tier + upset/loss + rounds). */
export interface DeepEventSignal {
  event: string;
  date: string;
  tier: Tier;
  eventRating: number; // 0..10 field strength from computeTournamentRating
  myPlace: number | null; // finishing position at the event
  fieldSize: number;
  myWorldRank: number | null; // world rank at the event's month (null = unranked)
  upsetWins: number; // beat couples ranked ABOVE the pair
  badLosses: number; // lost to couples ranked BELOW the pair
  roundOneExit: boolean; // eliminated in the first round
  reachedFinal: boolean;
}

export interface CoupleRating {
  available: boolean;
  reason?: string;
  rating: number; // 1..10
  tier: Tier;
  baseRating: number; // 0..10 before penalties
  worldRank: number | null;
  regionalRank: number | null;
  region: string | null; // from Represents
  components: CoupleRatingComponent[];
  penalties: CoupleRatingPenalty[];
  stats: {
    competitionsConsidered: number;
    avgPlace: number | null;
    finals: number;
    podiums: number;
    firstPlaces: number;
    monthsSinceLast: number | null;
    recentAvgPlace: number | null;
    olderAvgPlace: number | null;
    deepEventsAnalyzed: number;
    upsetWins: number; // total across deep events
    badLosses: number; // total across deep events
    roundOneExits: number;
  };
  events: DeepEventSignal[]; // per-event deep analysis (transparency)
}

// ── Parsing helpers ────────────────────────────────────────────────────────────

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/** Parse a WDSF date cell into a Date (best-effort), or null. */
export function parseWdsfDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null;
  const iso = dateStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
  const named = dateStr.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (named) {
    const mi = MONTHS.indexOf(named[2].toLowerCase());
    if (mi >= 0) return new Date(Date.UTC(+named[3], mi, +named[1]));
  }
  const dmy = dateStr.match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
  if (dmy) return new Date(Date.UTC(+dmy[3], +dmy[2] - 1, +dmy[1]));
  const t = Date.parse(dateStr);
  return isNaN(t) ? null : new Date(t);
}

/** Parse `place` into { place, field } — supports "5", "5.", "5 / 48", "5 of 48". */
function parsePlace(raw: string | null): { place: number | null; field: number | null } {
  if (!raw) return { place: null, field: null };
  const m = raw.match(/(\d+)\s*(?:\/|of|из|out of)\s*(\d+)/i);
  if (m) return { place: +m[1], field: +m[2] };
  const single = raw.match(/\d+/);
  return { place: single ? +single[0] : null, field: null };
}

// Heuristic event level (0..1) from the event name — only used as a FALLBACK for the
// tier sub-score when no deep per-event analysis is available.
function eventLevelHeuristic(comp: WdsfCompetition): number {
  const s = `${comp.event} ${comp.category}`.toLowerCase();
  if (/world championship|world games|olympic/.test(s)) return 1.0;
  if (/grand\s*slam/.test(s)) return 0.95;
  if (/world\s+open|world\s+ranking|continental championship|european championship/.test(s)) return 0.85;
  if (/international\s+open|world\s+cup/.test(s)) return 0.7;
  if (/\bopen\b/.test(s)) return 0.55;
  if (/national championship/.test(s)) return 0.45;
  return 0.35;
}

function tierForRating(rating: number): Tier {
  for (const b of RATING_BANDS) if (rating >= b.floor) return b.tier;
  return "Unrated";
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

// ── World-ranking standing (world + regional rank) ──────────────────────────────

export interface WorldStanding {
  rank: number;
  totalRanked: number;
  regionalRank: number | null;
}

export function deriveWorldStanding(
  ranking: RankedCouple[],
  athleteUuid: string,
  region: string | null,
): WorldStanding | null {
  const uuid = athleteUuid.toLowerCase();
  const me = ranking.find(
    (rc) => rc.manUuid?.toLowerCase() === uuid || rc.womanUuid?.toLowerCase() === uuid,
  );
  if (!me) return null;

  let regionalRank: number | null = null;
  if (region) {
    const reg = region.trim().toUpperCase();
    regionalRank =
      ranking
        .filter((rc) => rc.country.trim().toUpperCase() === reg)
        .sort((a, b) => a.rank - b.rank)
        .findIndex((rc) => rc.coupleId === me.coupleId) + 1 || null;
  }
  return { rank: me.rank, totalRanked: ranking.length, regionalRank };
}

// ── Deep per-event analysis (real tier + upsets + round-1 exit) ─────────────────

/** Build a uuid → best (lowest) world rank map from a ranking snapshot. */
function buildUuidRankMap(ranking: RankedCouple[]): Map<string, number> {
  // De-duplicate to each world couple's best rank first (WDSF can list tied ranks).
  const byCouple = new Map<number, RankedCouple>();
  for (const rc of ranking) {
    const prev = byCouple.get(rc.coupleId);
    if (!prev || rc.rank < prev.rank) byCouple.set(rc.coupleId, rc);
  }
  const map = new Map<string, number>();
  for (const rc of byCouple.values()) {
    for (const u of [rc.manUuid, rc.womanUuid]) {
      if (!u) continue;
      const k = u.toLowerCase();
      const ex = map.get(k);
      if (ex == null || rc.rank < ex) map.set(k, rc.rank);
    }
  }
  return map;
}

export interface CoupleScores {
  rounds: PrelimRound[];
  final: FinalResult | null;
  scores3: Scores3Result | null;
  final3: Score3Round | null;
}

/**
 * Resolve one event into a DeepEventSignal. `entries` is the event start/result list
 * (finishing order), `ranking` the World Ranking snapshot at the event's month, and
 * `scores` the pair's round-by-round marks (for round-1-exit detection); pass null to
 * skip the rounds signal.
 */
export function analyzeEvent(params: {
  event: string;
  date: string;
  entries: RankingEntry[];
  ranking: RankedCouple[];
  combinedType: string;
  snapshotMonth: string | null;
  athleteUuid: string;
  scores: CoupleScores | null;
}): DeepEventSignal {
  const { event, date, entries, ranking, combinedType, snapshotMonth, athleteUuid, scores } = params;

  const tr = computeTournamentRating(entries, ranking, combinedType, snapshotMonth);
  const uuidRank = buildUuidRankMap(ranking);
  const uuid = athleteUuid.toLowerCase();

  const myEntry = entries.find((e) =>
    e.athleteUrls.some((u) => extractUuid(u)?.toLowerCase() === uuid),
  );
  const myPlace = myEntry ? myEntry.rank : null;
  const fieldSize = entries.length;
  const myWorldRank = uuidRank.get(uuid) ?? null;

  // Upset wins / bad losses — only computable when we know the pair's own world rank.
  let upsetWins = 0;
  let badLosses = 0;
  if (myPlace != null && myWorldRank != null) {
    for (const e of entries) {
      if (e === myEntry) continue;
      let oppRank: number | null = null;
      for (const u of e.athleteUrls) {
        const k = extractUuid(u)?.toLowerCase();
        if (!k) continue;
        const r = uuidRank.get(k);
        if (r != null && (oppRank == null || r < oppRank)) oppRank = r;
      }
      if (oppRank == null) continue; // unranked opponent — ignore
      if (e.rank > myPlace && oppRank < myWorldRank) upsetWins++; // beat someone ranked above
      else if (e.rank < myPlace && oppRank > myWorldRank) badLosses++; // lost to someone ranked below
    }
  }

  // Round-1 exit — eliminated in the first round (no final, only one round danced).
  let reachedFinal = false;
  let roundsDanced = 0;
  if (scores) {
    reachedFinal = !!(
      (scores.final && (scores.final.dances.length > 0 || scores.final.overallPlace > 0)) ||
      (scores.final3 && scores.final3.dances.length > 0)
    );
    const sys2 = scores.rounds.length;
    const sys3 = scores.scores3?.rounds.length ?? 0;
    roundsDanced = Math.max(sys2, sys3);
  }
  const roundOneExit = !!scores && !reachedFinal && roundsDanced <= 1 && fieldSize > 12;

  return {
    event, date, tier: tr.tier, eventRating: tr.rating,
    myPlace, fieldSize, myWorldRank, upsetWins, badLosses, roundOneExit, reachedFinal,
  };
}

// ── Main computation ────────────────────────────────────────────────────────────

export interface CoupleRatingInput {
  standing: WorldStanding | null;
  deep?: DeepEventSignal[]; // recent events resolved with real tier/upset/round data
  now?: Date;
}

export function computeCoupleRating(
  profile: WdsfProfile,
  input: CoupleRatingInput = { standing: null },
): CoupleRating {
  const { standing = null, deep = [], now = new Date() } = input;
  const region = profile.represents?.trim() || null;

  const comps = [...profile.competitions]
    .map((c) => ({ comp: c, date: parseWdsfDate(c.date), parsed: parsePlace(c.place) }))
    .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0))
    .slice(0, MAX_COMPS);

  const placed = comps.filter((c) => c.parsed.place !== null);

  // Deep aggregates (used by several components/penalties below).
  const upsetWins = deep.reduce((s, e) => s + e.upsetWins, 0);
  const badLosses = deep.reduce((s, e) => s + e.badLosses, 0);
  const roundOneExits = deep.filter((e) => e.roundOneExit).length;

  if (!placed.length) {
    return {
      available: false,
      reason: "No competition results with a parseable placement.",
      rating: 1, tier: "D", baseRating: 0,
      worldRank: standing?.rank ?? null,
      regionalRank: standing?.regionalRank ?? null,
      region, components: [], penalties: [],
      stats: {
        competitionsConsidered: 0, avgPlace: null, finals: 0, podiums: 0, firstPlaces: 0,
        monthsSinceLast: null, recentAvgPlace: null, olderAvgPlace: null,
        deepEventsAnalyzed: deep.length, upsetWins, badLosses, roundOneExits,
      },
      events: deep,
    };
  }

  // ── Profile-level stats ──
  const places = placed.map((c) => c.parsed.place as number);
  const avgPlace = places.reduce((s, p) => s + p, 0) / places.length;
  const finals = placed.filter((c) => (c.parsed.place as number) <= 6).length;
  const podiums = placed.filter((c) => (c.parsed.place as number) <= 3).length;
  const firstPlaces = placed.filter((c) => (c.parsed.place as number) === 1).length;

  const half = Math.floor(placed.length / 2);
  const recent = placed.slice(0, Math.max(1, half));
  const older = placed.slice(Math.max(1, half));
  const recentAvgPlace = recent.reduce((s, c) => s + (c.parsed.place as number), 0) / recent.length;
  const olderAvgPlace = older.length
    ? older.reduce((s, c) => s + (c.parsed.place as number), 0) / older.length
    : recentAvgPlace;

  const monthsSinceLast =
    comps[0].date != null
      ? (now.getTime() - comps[0].date.getTime()) / (1000 * 60 * 60 * 24 * 30.44)
      : null;

  // ── Sub-scores (0..1) ──

  // 1) Average placement — normalised by field size when known.
  const placeScores = placed.map((c) => {
    const field = c.parsed.field ?? ASSUMED_FIELD;
    return clamp01(1 - ((c.parsed.place as number) - 1) / Math.max(field - 1, 1));
  });
  const avgPlaceScore = placeScores.reduce((s, v) => s + v, 0) / placeScores.length;

  // 2) Tournament level — REAL when deep events exist (avg field-strength rating,
  //    recency-weighted); else fall back to the event-name heuristic.
  let levelScore: number;
  let levelDetail: string;
  if (deep.length) {
    const w = (i: number) => 1 - i / (deep.length * 2);
    const num = deep.reduce((s, e, i) => s + (e.eventRating / 10) * w(i), 0);
    const den = deep.reduce((s, _e, i) => s + w(i), 0);
    levelScore = clamp01(num / den);
    const tiers = deep.map((e) => e.tier).join(",");
    levelDetail = `real tiers over ${deep.length} events: ${tiers}`;
  } else {
    const num = placed.reduce((s, c, i) => s + eventLevelHeuristic(c.comp) * (1 - i / (placed.length * 2)), 0);
    const den = placed.reduce((s, _c, i) => s + (1 - i / (placed.length * 2)), 0);
    levelScore = clamp01(num / den);
    levelDetail = `name-based estimate (${(levelScore * 100).toFixed(0)}%)`;
  }

  // 3) World standing — own world-rank percentile blended with real upset wins
  //    (couples beaten that were ranked above the pair).
  const percentile = standing ? clamp01(1 - (standing.rank - 1) / Math.max(standing.totalRanked, 1)) : 0;
  const upsetScore = clamp01(upsetWins / UPSET_SATURATION);
  const worldStandingScore = deep.length
    ? clamp01(percentile * 0.6 + upsetScore * 0.4)
    : percentile;
  const worldStandingDetail = standing
    ? `world #${standing.rank}/${standing.totalRanked}` +
      (deep.length ? `, ${upsetWins} upset wins` : "")
    : deep.length
      ? `unranked, ${upsetWins} upset wins`
      : "not in ranking";

  // 4) Finals + podiums share.
  const finalsPodiumScore = clamp01((finals / placed.length) * 0.6 + (podiums / placed.length) * 0.4);

  // 5) Trend — positive when recent placements improved over older ones.
  const trendDelta = olderAvgPlace - recentAvgPlace;
  const trendScore = clamp01(0.5 + trendDelta / 20);

  const components: CoupleRatingComponent[] = [
    { key: "avgPlace", label: "Average placement", weight: WEIGHTS.avgPlace, score: avgPlaceScore, detail: `avg place ${avgPlace.toFixed(1)} over ${placed.length} comps` },
    { key: "tier", label: "Tournament level", weight: WEIGHTS.tier, score: levelScore, detail: levelDetail },
    { key: "worldStanding", label: "World ranking & upsets", weight: WEIGHTS.worldStanding, score: worldStandingScore, detail: worldStandingDetail },
    { key: "finalsPodium", label: "Finals & podiums", weight: WEIGHTS.finalsPodium, score: finalsPodiumScore, detail: `${finals} finals, ${podiums} podiums` },
    { key: "trend", label: "Form trend", weight: WEIGHTS.trend, score: trendScore, detail: `recent ${recentAvgPlace.toFixed(1)} vs older ${olderAvgPlace.toFixed(1)}` },
  ];

  const weighted = components.reduce((s, c) => s + c.score * c.weight, 0);
  const base = weighted * 10;

  // ── Penalties ──
  const penalties: CoupleRatingPenalty[] = [];

  // Inactivity: 4 months+ bleeds rating, escalating with time away.
  if (monthsSinceLast !== null && monthsSinceLast > 4) {
    const amount = Math.min(3, (monthsSinceLast - 4) * 0.35);
    penalties.push({ key: "inactivity", label: "Inactivity", amount, detail: `${monthsSinceLast.toFixed(1)} months since last competition` });
  }

  // Worsening placements (recent clearly worse than older).
  if (recentAvgPlace - olderAvgPlace > 2) {
    const amount = Math.min(1.5, (recentAvgPlace - olderAvgPlace) * 0.15);
    penalties.push({ key: "decline", label: "Declining results", amount, detail: `recent avg place worsened by ${(recentAvgPlace - olderAvgPlace).toFixed(1)}` });
  }

  if (deep.length) {
    // Bad losses — lost to couples ranked BELOW the pair (real underperformance).
    if (badLosses > 0) {
      const amount = Math.min(2, badLosses * 0.12);
      penalties.push({ key: "badLosses", label: "Losses to lower-ranked", amount, detail: `${badLosses} losses to couples ranked below across ${deep.length} events` });
    }
    // Round-1 exits — eliminated in the first round.
    if (roundOneExits > 0) {
      const amount = Math.min(1.5, roundOneExits * 0.5);
      penalties.push({ key: "roundOneExit", label: "Early-round exits", amount, detail: `${roundOneExits} first-round eliminations` });
    }
  } else {
    // Heuristic weak-result penalty when no deep round data is available.
    const weak = placed.filter((c) => {
      const field = c.parsed.field ?? ASSUMED_FIELD;
      return (c.parsed.place as number) > Math.max(field * 0.7, 24);
    }).length;
    if (weak / placed.length > 0.3) {
      const amount = Math.min(1.5, (weak / placed.length) * 2);
      penalties.push({ key: "weakResults", label: "Weak results", amount, detail: `${weak}/${placed.length} deep placements` });
    }
  }

  const penaltyTotal = penalties.reduce((s, p) => s + p.amount, 0);
  const rating = Math.max(1, Math.min(10, Math.round((base - penaltyTotal) * 10) / 10));

  return {
    available: true,
    rating,
    tier: tierForRating(rating),
    baseRating: Math.round(base * 10) / 10,
    worldRank: standing?.rank ?? null,
    regionalRank: standing?.regionalRank ?? null,
    region,
    components,
    penalties,
    stats: {
      competitionsConsidered: placed.length,
      avgPlace: Math.round(avgPlace * 10) / 10,
      finals, podiums, firstPlaces,
      monthsSinceLast: monthsSinceLast === null ? null : Math.round(monthsSinceLast * 10) / 10,
      recentAvgPlace: Math.round(recentAvgPlace * 10) / 10,
      olderAvgPlace: Math.round(olderAvgPlace * 10) / 10,
      deepEventsAnalyzed: deep.length,
      upsetWins, badLosses, roundOneExits,
    },
    events: deep,
  };
}
