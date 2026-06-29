import { load } from "cheerio";
import {
  WDSF_BASE,
  FETCH_HEADERS,
  extractUuid,
  nameTokens,
  type RankingEntry,
} from "./wdsfScraper";

// ─── WDSF World Ranking client + Tournament Rating computation ─────────────────
//
// The WDSF ranking page (/Ranking/World) is rendered client-side from a JSON API:
//   POST /api/listitems/ranking
// A session is required: GET /Ranking/World once to obtain the antiforgery cookie
// and the __RequestVerificationToken hidden field, which is echoed back in the
// `RequestVerificationToken` header on the POST.
//
// The "CombinedType" selects the list:  division_ageGroup_discipline_0_subtype
//   division   1 = General
//   discipline 56 = Standard, 55 = Latin
//   ageGroup   180 Adult · 179 Youth · 178 Junior II · 190 Under 21 ·
//              181/182/183/196/220 Senior I–V · 186 Rising Stars
// (Junior I = 177 has only single-dance rankings → no combined Std/Lat list.)

const RANKING_PAGE_URL = `${WDSF_BASE}/Ranking/World`;
const RANKING_API_URL = `${WDSF_BASE}/api/listitems/ranking`;
const PAGE_SIZE = 25; // server caps each page at 25 regardless of requested size

// ─── CombinedType mapping ──────────────────────────────────────────────────────

const DISCIPLINE_CODE: Record<string, string> = {
  standard: "56",
  std: "56",
  ballroom: "56",
  latin: "55",
  lat: "55",
};

// Normalized age-group label → WDSF age-group code. Junior I and divisions that
// only have single-dance rankings are intentionally absent (→ unavailable).
const AGE_GROUP_CODE: Record<string, string> = {
  adult: "180",
  youth: "179",
  "junior ii": "178",
  "junior 2": "178",
  "under 21": "190",
  u21: "190",
  "senior i": "181",
  "senior 1": "181",
  "senior ii": "182",
  "senior 2": "182",
  "senior iii": "183",
  "senior 3": "183",
  "senior iv": "196",
  "senior 4": "196",
  "senior v": "220",
  "senior 5": "220",
  "rising stars": "186",
};

function normalizeDiscipline(discipline: string): string | null {
  const key = discipline.trim().toLowerCase();
  if (DISCIPLINE_CODE[key]) return DISCIPLINE_CODE[key];
  // Tolerate values like "Adult Standard", "STD/LAT" embedded in a longer string
  if (/\bstandard\b|\bstd\b|\bballroom\b/.test(key)) return "56";
  if (/\blatin\b|\blat\b/.test(key)) return "55";
  return null;
}

function normalizeAgeGroup(category: string): string | null {
  let key = category.trim().toLowerCase();
  // Strip a trailing discipline word if the category carries it (e.g. "Adult Latin")
  key = key.replace(/\b(standard|std|ballroom|latin|lat|ten dance|10 dance)\b/g, "").trim();
  key = key.replace(/\s+/g, " ");
  if (AGE_GROUP_CODE[key]) return AGE_GROUP_CODE[key];
  // Substring fallbacks for the most common longer labels
  for (const [label, code] of Object.entries(AGE_GROUP_CODE)) {
    if (key.includes(label)) return code;
  }
  return null;
}

/**
 * Build the WDSF `CombinedType` for an age category + discipline, or null when
 * the combination has no combined Standard/Latin world ranking (Junior I,
 * Ten Dance, single dances, Breaking, etc.).
 */
export function combinedTypeFor(category: string, discipline: string): string | null {
  const disc = normalizeDiscipline(discipline) ?? normalizeDiscipline(category);
  const age = normalizeAgeGroup(category);
  if (!disc || !age) return null;
  return `1_${age}_${disc}_0_0`;
}

// Age-group tokens, most-specific first so "Senior I" never shadows "Senior III".
const AGE_TOKENS: [RegExp, string][] = [
  [/\bsenior v\b/, "220"], [/\bsenior iv\b/, "196"], [/\bsenior iii\b/, "183"],
  [/\bsenior ii\b/, "182"], [/\bsenior i\b/, "181"],
  [/\bunder 21\b|\bu21\b/, "190"], [/\bjunior ii\b/, "178"],
  [/\byouth\b/, "179"], [/\badult\b/, "180"], [/\brising stars\b/, "186"],
];

/**
 * Derive a `CombinedType` by scanning free text (a competition slug/URL or name,
 * e.g. ".../GrandSlam-Blackpool-Adult-Standard-65351") for age + discipline tokens.
 * Resilient fallback for when a profile's category/discipline columns are unreliable.
 */
export function combinedTypeFromText(text: string): string | null {
  const s = text.toLowerCase().replace(/[-_]+/g, " ").replace(/\s+/g, " ");
  if (/\bten dance\b|\b10 dance\b/.test(s)) return null; // unsupported (no combined ranking)
  const disc = /\bstandard\b|\bballroom\b/.test(s) ? "56" : /\blatin\b/.test(s) ? "55" : null;
  if (!disc) return null;
  for (const [re, code] of AGE_TOKENS) if (re.test(s)) return `1_${code}_${disc}_0_0`;
  return null;
}

// ─── CombinedType → human-readable category ────────────────────────────────────

// Reverse of AGE_GROUP_CODE / DISCIPLINE_CODE: WDSF code → display label.
const AGE_LABEL: Record<string, string> = {
  "180": "Adult", "179": "Youth", "178": "Junior II", "190": "Under 21",
  "181": "Senior I", "182": "Senior II", "183": "Senior III", "196": "Senior IV", "220": "Senior V",
  "186": "Rising Stars",
};
const DISC_LABEL: Record<string, string> = { "56": "Standard", "55": "Latin" };

// Display order for category pickers: Adult first, then Rising Stars, then youngest→oldest.
const AGE_ORDER = ["180", "186", "190", "179", "178", "181", "182", "183", "196", "220"];

export interface CategoryInfo {
  combinedType: string;
  ageCode: string;
  discCode: string;
  ageLabel: string;
  discLabel: string;
  label: string; // e.g. "Adult Latin", "Rising Stars Standard"
}

/** Describe a `CombinedType` (e.g. "1_180_55_0_0") as a labelled category, or null. */
export function describeCombinedType(combinedType: string): CategoryInfo | null {
  const parts = combinedType.split("_");
  if (parts.length < 3) return null;
  const [, ageCode, discCode] = parts;
  const ageLabel = AGE_LABEL[ageCode];
  const discLabel = DISC_LABEL[discCode];
  if (!ageLabel || !discLabel) return null;
  return { combinedType, ageCode, discCode, ageLabel, discLabel, label: `${ageLabel} ${discLabel}` };
}

/** Sort key so category lists read Adult Latin · Adult Standard · Rising Stars … */
export function categorySortKey(combinedType: string): number {
  const info = describeCombinedType(combinedType);
  if (!info) return 9999;
  const ai = AGE_ORDER.indexOf(info.ageCode);
  const di = info.discCode === "55" ? 0 : 1; // Latin before Standard
  return (ai < 0 ? 99 : ai) * 2 + di;
}

// ─── Ranking fetch ─────────────────────────────────────────────────────────────

export interface RankedCouple {
  rank: number;
  points: number;
  coupleId: number;
  country: string;
  man: string;
  woman: string;
  manUuid: string | null;
  womanUuid: string | null;
}

interface RankingApiItem {
  kind?: string;
  rank?: number;
  points?: number;
  coupleId?: number;
  country?: string;
  man?: string;
  woman?: string;
  profile_man?: string;
  profile_woman?: string;
}

interface RankingApiResponse {
  items?: RankingApiItem[];
  prevFilter?: string;
  page?: number;
}

/** GET the ranking page to obtain the antiforgery cookie + token for the POST. */
async function openRankingSession(): Promise<{ cookie: string; token: string }> {
  const res = await fetch(RANKING_PAGE_URL, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`WDSF ranking page HTTP ${res.status}`);

  const setCookies: string[] =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : (res.headers.get("set-cookie") ? [res.headers.get("set-cookie") as string] : []);
  // Keep only the name=value part of each cookie (drop attributes like Path/HttpOnly).
  const cookie = setCookies.map((c) => c.split(";")[0]).join("; ");

  const $ = load(await res.text());
  const token = $('input[name="__RequestVerificationToken"]').first().attr("value") ?? "";
  if (!token) throw new Error("WDSF ranking token not found");

  return { cookie, token };
}

async function postRankingPage(
  session: { cookie: string; token: string },
  combinedType: string,
  pageIndex: number,
  prevFilter: string,
  dateISO: string | null,
): Promise<RankingApiResponse> {
  const res = await fetch(RANKING_API_URL, {
    method: "POST",
    headers: {
      ...FETCH_HEADERS,
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      "RequestVerificationToken": session.token,
      "Cookie": session.cookie,
      "Referer": RANKING_PAGE_URL,
    },
    body: JSON.stringify({
      CombinedType: combinedType,
      PageIndex: pageIndex,
      PageSize: PAGE_SIZE,
      PrevFilter: prevFilter,
      Name: "",
      CountryId: null,
      Date: dateISO,
    }),
  });
  if (!res.ok) throw new Error(`WDSF ranking API HTTP ${res.status}`);
  return (await res.json()) as RankingApiResponse;
}

function toRankedCouple(item: RankingApiItem): RankedCouple | null {
  if (item.kind !== "couple" || typeof item.rank !== "number") return null;
  return {
    rank: item.rank,
    points: item.points ?? 0,
    coupleId: item.coupleId ?? 0,
    country: item.country ?? "",
    man: item.man ?? "",
    woman: item.woman ?? "",
    manUuid: item.profile_man ? extractUuid(item.profile_man) : null,
    womanUuid: item.profile_woman ? extractUuid(item.profile_woman) : null,
  };
}

/**
 * Fetch the world ranking for `combinedType` up to `topN` couples, paginating the
 * 25-per-page API. `dateISO` (YYYY-MM-DD) requests the historical monthly snapshot;
 * omit/null for the current ranking.
 */
export async function fetchWorldRanking(
  combinedType: string,
  topN: number,
  dateISO: string | null = null,
): Promise<RankedCouple[]> {
  const session = await openRankingSession();
  const out: RankedCouple[] = [];
  let prevFilter = "";
  const maxPages = Math.ceil(topN / PAGE_SIZE) + 1;

  for (let page = 1; out.length < topN && page <= maxPages; page++) {
    const json = await postRankingPage(session, combinedType, page, prevFilter, dateISO);
    const items = json.items ?? [];
    if (!items.length) break;
    for (const it of items) {
      const rc = toRankedCouple(it);
      if (rc) out.push(rc);
    }
    if (typeof json.prevFilter === "string") prevFilter = json.prevFilter;
  }

  out.sort((a, b) => a.rank - b.rank);
  return out.slice(0, topN);
}

// ─── Tournament rating computation ─────────────────────────────────────────────

export type Tier = "S" | "A" | "B" | "C" | "D" | "Unrated";

export interface TournamentRating {
  available: boolean;
  reason?: string;
  tier: Tier;
  rating: number; // 0–10, one decimal
  participants: number; // couples at the event we could check
  n30: number;
  n50: number;
  n100: number;
  n200: number;
  bestRank: number | null;
  matched: { coupleName: string; worldRank: number; points: number }[];
  combinedType: string;
  snapshotMonth: string | null;
}

// ── Tunable constants (single source of truth for the tier model) ──────────────
const TOP_N = 200; // depth of the world ranking we compare against (D-tier reaches ~200)

// Tier thresholds: highest tier whose condition holds wins.
// Counts are of participating couples found within the given world-rank bracket.
const TIER_RULES: { tier: Exclude<Tier, "Unrated">; cond: (c: Counts) => boolean; band: [number, number] }[] = [
  { tier: "S", band: [9, 10],  cond: (c) => c.n30 >= 6 },
  { tier: "A", band: [7, 8.9], cond: (c) => c.n50 >= 6 || c.n30 >= 3 },
  { tier: "B", band: [5, 6.9], cond: (c) => c.n100 >= 6 || c.n50 >= 3 },
  { tier: "C", band: [3, 4.9], cond: (c) => c.n200 >= 6 || c.n100 >= 3 },
  { tier: "D", band: [1, 2.9], cond: (c) => c.n200 >= 1 },
];

// Age-group rating caps. Younger divisions have far shallower world rankings than
// Adult, so even a "stacked" field shouldn't reach the very top of the 0–10 scale.
// Keyed by the WDSF age-group code (the `<age>` in CombinedType `1_<age>_<disc>_0_0`).
//   179 Youth · 190 Under 21 → max 8 (A-tier ceiling)
//   178 Junior II (youngest division with a combined ranking) → max 6.9 (B-tier ceiling)
const AGE_RATING_CAP: Record<string, number> = {
  "179": 8,    // Youth
  "190": 8,    // Under 21
  "178": 6.9,  // Junior II (and younger)
};

function ratingCapFor(combinedType: string): number | null {
  const age = combinedType.split("_")[1];
  return age in AGE_RATING_CAP ? AGE_RATING_CAP[age] : null;
}

// Map a rating value back to its tier (highest band whose floor it clears).
function tierForRating(rating: number): Tier {
  for (const r of TIER_RULES) if (rating >= r.band[0]) return r.tier;
  return "Unrated";
}

// Per-couple weight by world-rank bracket, used to size the rating within a band.
function coupleWeight(rank: number): number {
  if (rank <= 30) return 3;
  if (rank <= 50) return 1.5;
  if (rank <= 100) return 0.6;
  return 0.25;
}
// Strength at which a tier's rating saturates to the top of its band.
const SATURATION_SCORE = 24;

interface Counts {
  n30: number;
  n50: number;
  n100: number;
  n200: number;
}

function uuidsOf(entry: RankingEntry): string[] {
  const out: string[] = [];
  for (const url of entry.athleteUrls) {
    const u = extractUuid(url);
    if (u) out.push(u.toLowerCase());
  }
  return out;
}

/**
 * Match a competition's participants against a world-ranking snapshot (by athlete
 * UUID) and grade the strength of the field into a tier + 0–10 rating.
 */
export function computeTournamentRating(
  allCouples: RankingEntry[],
  ranking: RankedCouple[],
  combinedType: string,
  snapshotMonth: string | null,
): TournamentRating {
  // uuid → its best (lowest-rank) world couple. WDSF can have tied ranks, so we key
  // de-duplication on the world coupleId, not on the rank value.
  const uuidToCouple = new Map<string, RankedCouple>();
  for (const rc of ranking) {
    for (const u of [rc.manUuid, rc.womanUuid]) {
      if (!u) continue;
      const key = u.toLowerCase();
      const prev = uuidToCouple.get(key);
      if (!prev || rc.rank < prev.rank) uuidToCouple.set(key, rc);
    }
  }

  const matched: { coupleName: string; worldRank: number; points: number }[] = [];
  const seenCoupleIds = new Set<number>();
  for (const couple of allCouples) {
    let best: RankedCouple | null = null;
    for (const u of uuidsOf(couple)) {
      const rc = uuidToCouple.get(u);
      if (rc && (best === null || rc.rank < best.rank)) best = rc;
    }
    if (!best || seenCoupleIds.has(best.coupleId)) continue; // one world couple counted once
    seenCoupleIds.add(best.coupleId);
    matched.push({ coupleName: couple.coupleName, worldRank: best.rank, points: best.points });
  }
  matched.sort((a, b) => a.worldRank - b.worldRank);

  const counts: Counts = {
    n30: matched.filter((m) => m.worldRank <= 30).length,
    n50: matched.filter((m) => m.worldRank <= 50).length,
    n100: matched.filter((m) => m.worldRank <= 100).length,
    n200: matched.filter((m) => m.worldRank <= 200).length,
  };
  const bestRank = matched.length ? matched[0].worldRank : null;

  const rule = TIER_RULES.find((r) => r.cond(counts));
  if (!rule) {
    return {
      available: true,
      tier: "Unrated",
      rating: 0,
      participants: allCouples.length,
      ...counts,
      bestRank,
      matched,
      combinedType,
      snapshotMonth,
    };
  }

  // Rating: place within the tier's band by weighted field strength, with a small
  // boost for an exceptional top entrant. Clamped into [bandLo, bandHi].
  const score =
    matched.reduce((s, m) => s + coupleWeight(m.worldRank), 0) +
    (bestRank !== null && bestRank <= 3 ? 1.5 : bestRank !== null && bestRank <= 10 ? 0.7 : 0);
  const [lo, hi] = rule.band;
  const intensity = Math.min(1, score / SATURATION_SCORE);
  let rating = Math.round((lo + (hi - lo) * intensity) * 10) / 10;
  let tier: Tier = rule.tier;

  // Clamp younger divisions to their age-group ceiling, then re-derive the tier
  // so the badge letter stays consistent with the (capped) number.
  const cap = ratingCapFor(combinedType);
  if (cap !== null && rating > cap) {
    rating = cap;
    tier = tierForRating(rating);
  }

  return {
    available: true,
    tier,
    rating,
    participants: allCouples.length,
    ...counts,
    bestRank,
    matched,
    combinedType,
    snapshotMonth,
  };
}

export const RANKING_TOP_N = TOP_N;

// ─── Name-based tournament rating (for manual / TopTurnier analysis) ────────────
//
// TopTurnier results have no WDSF athlete UUIDs, so we match couples to the World
// Ranking by NAME. Because that match is partial by nature (only some of a national
// field is WDSF-ranked), the field strength is additionally scaled by how MANY of
// the participants we could place in the ranking: a tournament where only 5 of 20
// couples are world-ranked is a weak field a-priori, even if those 5 rank highly.

/** Strength reaches full weight when ≥ this fraction of the field is world-ranked. */
const FULL_DENSITY_AT = 0.5;

/** Do two people (token sets) plausibly refer to the same person? */
function personMatch(a: Set<string>, b: Set<string>): boolean {
  let shared = 0;
  for (const t of a) if (t.length >= 2 && b.has(t)) shared++;
  return shared >= 1;
}

/** Find the world couple a TopTurnier entry name refers to (both partners must match). */
function matchEntryToRanking(coupleName: string, ranking: RankedCouple[]): RankedCouple | null {
  const partners = coupleName.split("/").map((p) => nameTokens(p)).filter((s) => s.size);
  if (partners.length < 2) return null;
  const [a, b] = partners;
  let best: RankedCouple | null = null;
  for (const rc of ranking) {
    const man = nameTokens(rc.man);
    const woman = nameTokens(rc.woman);
    const matched =
      (personMatch(a, man) && personMatch(b, woman)) ||
      (personMatch(a, woman) && personMatch(b, man));
    if (matched && (best === null || rc.rank < best.rank)) best = rc;
  }
  return best;
}

/**
 * Grade a competition's field by matching its couples to the World Ranking by NAME,
 * then scaling the result down when only a small share of the field is world-ranked.
 * Returns the same `TournamentRating` shape the WDSF path produces.
 */
export function computeTournamentRatingByName(
  allCouples: RankingEntry[],
  ranking: RankedCouple[],
  combinedType: string,
  snapshotMonth: string | null,
): TournamentRating {
  const matched: { coupleName: string; worldRank: number; points: number }[] = [];
  const seenCoupleIds = new Set<number>();
  for (const couple of allCouples) {
    const rc = matchEntryToRanking(couple.coupleName, ranking);
    if (!rc || seenCoupleIds.has(rc.coupleId)) continue; // one world couple counted once
    seenCoupleIds.add(rc.coupleId);
    matched.push({ coupleName: couple.coupleName, worldRank: rc.rank, points: rc.points });
  }
  matched.sort((a, b) => a.worldRank - b.worldRank);

  const counts: Counts = {
    n30: matched.filter((m) => m.worldRank <= 30).length,
    n50: matched.filter((m) => m.worldRank <= 50).length,
    n100: matched.filter((m) => m.worldRank <= 100).length,
    n200: matched.filter((m) => m.worldRank <= 200).length,
  };
  const bestRank = matched.length ? matched[0].worldRank : null;
  const participants = allCouples.length;

  const rule = TIER_RULES.find((r) => r.cond(counts));
  if (!rule) {
    return {
      available: true, tier: "Unrated", rating: 0, participants,
      ...counts, bestRank, matched, combinedType, snapshotMonth,
    };
  }

  // Base rating within the tier band (same model as the UUID path)…
  const score =
    matched.reduce((s, m) => s + coupleWeight(m.worldRank), 0) +
    (bestRank !== null && bestRank <= 3 ? 1.5 : bestRank !== null && bestRank <= 10 ? 0.7 : 0);
  const [lo, hi] = rule.band;
  const intensity = Math.min(1, score / SATURATION_SCORE);
  let rating = lo + (hi - lo) * intensity;

  // …then scale by ranked-density so a sparse field rates low a-priori.
  const density = participants > 0 ? matched.length / participants : 0;
  const densityFactor = Math.min(1, density / FULL_DENSITY_AT);
  rating = Math.round(rating * densityFactor * 10) / 10;

  let tier: Tier = tierForRating(rating);
  const cap = ratingCapFor(combinedType);
  if (cap !== null && rating > cap) { rating = cap; tier = tierForRating(rating); }

  return {
    available: true, tier, rating, participants,
    ...counts, bestRank, matched, combinedType, snapshotMonth,
  };
}
