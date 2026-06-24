import { load } from "cheerio";
import type { CheerioAPI, Cheerio } from "cheerio";
import type { Element } from "domhandler";

const WDSF_BASE = "https://www.worlddancesport.org";

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

// ─── Base Profile Types ──────────────────────────────────────────────────────

export interface WdsfCompetition {
  date: string;
  event: string;
  location: string;
  discipline: string;
  category: string;
  place: string | null;
  points: string | null;
  competitionUrl: string | null; // e.g. /Competitions/Ranking/slug
}

export interface WdsfPartner {
  name: string;
  nationality: string | null;
  represents: string | null;
  status: "current" | "former";
  since: string | null;
  until: string | null;
  profileUrl: string | null;
}

export interface WdsfProfile {
  uuid: string;
  profileUrl: string;
  firstName: string;
  lastName: string;
  name: string;
  nationality: string;
  represents: string;
  min: string;
  ageGroup: string | null;
  licenseDivision: string | null;
  licenseStatus: string | null;
  licenseExpiry: string | null;
  photoUrl: string;
  competitions: WdsfCompetition[];
  partners: WdsfPartner[];
  fetchedAt: string;
}

// ─── Competition Analytics Types ─────────────────────────────────────────────

export interface JudgeCross {
  judge: string;
  marked: boolean;
}

export interface DancePrelimMarks {
  dance: string;
  crosses: JudgeCross[];
  totalCrosses: number;
}

export interface PrelimRound {
  roundNumber: number;
  dances: DancePrelimMarks[];
  totalCrosses: number;
}

export interface FinalJudgePlacement {
  judge: string;
  place: number;
}

export interface FinalDanceResult {
  dance: string;
  judgeEntries: FinalJudgePlacement[];
  dancePlace: number;
}

export interface FinalResult {
  dances: FinalDanceResult[];
  overallPlace: number;
  judgeAvgPlaces: { judge: string; avgPlace: number }[];
}

export interface RankingEntry {
  rank: number;
  coupleName: string;
  country: string;
  coupleNumber: string;
  points: string;
  athleteUrls: string[];
}

// ─── System 3.0 Scoring Types ─────────────────────────────────────────────────

// In WDSF System 3.0 each adjudicator evaluates exactly ONE area for a given dance:
// either "Technical Quality & Partnering Skill" (TQ & PS) or
// "Movement to Music & Choreography/Presentation" (MM & CP).
// Competitions display this in one of two formats:
//   • 2-column: a single combined value per area  → tqPs / mmCp populated
//   • 4-column: the area split into two criteria   → (tq, ps) or (mm, cp) populated
export interface Score3JudgeEntry {
  judge: string;
  tqPs: number | null;  // combined "TQ & PS" value (2-column competitions)
  mmCp: number | null;  // combined "MM & CP" value (2-column competitions)
  tq: number | null;    // Technical Quality      (4-column competitions)
  mm: number | null;    // Movement to Music       (4-column competitions)
  ps: number | null;    // Partnering Skill        (4-column competitions)
  cp: number | null;    // Choreography & Presentation (4-column competitions)
  rank: number;         // this judge's ranking of the couple in this dance (0 if none)
}

// "Component score" row (tfoot) — the averaged contribution of each area / criterion.
export interface Score3Components {
  tqPs: number | null;
  mmCp: number | null;
  tq: number | null;
  mm: number | null;
  ps: number | null;
  cp: number | null;
}

export interface Score3Dance {
  dance: string;
  judgeEntries: Score3JudgeEntry[];
  place: number;       // couple's place in this dance (Final rounds); 0 for prelim
  totalMarks: number;  // total criteria marks (prelim rounds); 0 for Final
  totalScore: number;  // dance total (sum of component scores), e.g. 38.200; 0 if unknown
  components: Score3Components; // per-criterion averages from the "Component score" row
  fourCriteria: boolean;        // true when the dance used 4 separate criteria columns
}

export interface Score3Round {
  roundName: string;    // "Final", "Semi-Final", etc.
  dances: Score3Dance[];
  overallPlace: number;
}

export interface Scores3Result {
  rounds: Score3Round[];
}

export interface CompetitionAnalytics {
  competitionSlug: string;
  competitionName: string;
  rankingUrl: string;
  coupleNumber: string;
  coupleName: string;
  rounds: PrelimRound[];
  final: FinalResult | null;
  final3: Score3Round | null;   // System 3.0 Final (in FinalTab)
  scores3: Scores3Result | null; // System 3.0 qualifying rounds (in Scores3Tab)
  danceStats: { dance: string; totalCrosses: number; avgPerRound: number }[];
  judgeStats: { judge: string; totalCrosses: number; pct: number }[];
  totalPossibleCrosses: number;
  reachedFinal: boolean;
  allCouples: RankingEntry[];
  judgeNames: Record<string, string>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function extractUuid(url: string): string | null {
  const m = url.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return m?.[1] ?? null;
}

export function buildPhotoUrl(uuid: string): string {
  return `${WDSF_BASE}/api/picture/person/${uuid}?useAlternate=False`;
}

/** Returns true when a table cell value represents a cross (marked by judge). */
function isCross(raw: string): boolean {
  const t = raw.trim();
  if (!t || t === "-" || t === "–" || t === "0" || t === "n/a") return false;
  // Multi-digit numbers = totals column — not a cross mark
  if (/^\d{2,}$/.test(t)) return false;
  // Single digit in a JUDGE column could be 1 (rare). Treat non-zero single digit as cross.
  if (/^\d$/.test(t)) return t !== "0";
  // Any symbol: *, +, ×, x, X, ✓, ✗ etc.
  return true;
}

// Extract competition slug from any /Competitions/{type}/slug URL
function extractSlug(url: string): string {
  const m = url.match(/\/Competitions\/[^/]+\/(.+)/);
  return m?.[1] ?? url;
}

/** Build URL variants for a competition */
function buildCompUrls(slugOrUrl: string) {
  const slug = extractSlug(slugOrUrl);
  return {
    slug,
    ranking:  `${WDSF_BASE}/Competitions/Ranking/${slug}`,
    marks:    `${WDSF_BASE}/Competitions/Marks/${slug}`,
    final:    `${WDSF_BASE}/Competitions/Final/${slug}`,
    scores:   `${WDSF_BASE}/Competitions/Scores/${slug}`,
    officials:`${WDSF_BASE}/Competitions/Officials/${slug}`,
  };
}

// ─── Column-map builder for multi-level mark tables ──────────────────────────

interface ColInfo {
  type: "couple" | "round" | "total" | "rank" | "judge" | "danceTotal" | "skip";
  dance: string | null;
  judge: string | null;
}

function buildMarkColumnMap($table: Cheerio<Element>, $: CheerioAPI): ColInfo[] {
  const headerRows = $table.find("thead tr").toArray();
  if (!headerRows.length) return [];

  // Estimate total columns from all cells in first row
  const totalCols = $(headerRows[0]).find("th, td").toArray()
    .reduce((s, el) => s + parseInt($(el).attr("colspan") ?? "1", 10), 0);

  const map: ColInfo[] = Array.from({ length: totalCols }, () => ({
    type: "skip" as const,
    dance: null,
    judge: null,
  }));

  // rowspan=2 columns don't appear in the second row
  const rowspanned = new Set<number>();

  for (let ri = 0; ri < Math.min(headerRows.length, 2); ri++) {
    const ths = $(headerRows[ri]).find("th, td").toArray();
    let ci = 0;

    for (const th of ths) {
      // Skip positions filled by rowspan
      while (rowspanned.has(ci)) ci++;

      const raw = $(th).text().trim();
      const lower = raw.toLowerCase();
      const colspan = parseInt($(th).attr("colspan") ?? "1", 10);
      const rowspan = parseInt($(th).attr("rowspan") ?? "1", 10);

      for (let k = 0; k < colspan; k++) {
        const idx = ci + k;
        if (idx >= map.length) break;

        if (ri === 0) {
          if (
            lower === "couple" || lower === "#" || lower === "st." || lower === "start" ||
            lower === "nr" || lower === "nr." || lower === "no." || lower === "no" ||
            lower === "pair" || lower === "pair no." || lower === "pair no" || lower === "st#"
          ) {
            map[idx].type = "couple";
          } else if (lower === "round" || lower === "rnd" || lower === "rd" || lower === "rd.") {
            map[idx].type = "round";
          } else if (lower === "total" || lower === "tot" || lower === "sum") {
            map[idx].type = "total";
          } else if (lower === "rank" || lower === "place" || lower === "pos" || lower === "rk") {
            map[idx].type = "rank";
          } else if (raw === "=") {
            map[idx].type = "danceTotal";
          } else {
            // Treat as dance name
            map[idx].dance = raw;
            map[idx].type = "judge"; // will be refined in row 2
          }
        } else {
          // Second header row fills in judge letters.
          // Only modify columns that are still "judge" (set as dance header in row 0) or "skip".
          // Never override couple/round/total/rank/danceTotal already identified in row 0.
          if (raw === "=") {
            map[idx].type = "danceTotal";
          } else if (lower === "rank" || lower === "place") {
            map[idx].type = "rank";
          } else if (lower === "total" || lower === "tot") {
            map[idx].type = "total";
          } else if (map[idx].type === "judge") {
            // Fill in the judge letter only for columns already tagged as judge in row 0
            if (raw) {
              map[idx].judge = raw;
            } else {
              map[idx].type = "skip"; // empty cell in judge position → not a real judge column
            }
          }
          // For any other pre-classified type (couple, round, total, rank, danceTotal) — leave unchanged
        }

        if (rowspan > 1) rowspanned.add(idx);
      }

      ci += colspan;
    }
  }

  return map;
}

// ─── Ranking page scraper ─────────────────────────────────────────────────────

async function scrapeRankingPage(rankingUrl: string): Promise<{
  competitionName: string;
  entries: RankingEntry[];
}> {
  const res = await fetch(rankingUrl, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ranking page`);
  const $ = load(await res.text());

  const competitionName = $("h1, h2").first().text().trim() || "";
  const entries: RankingEntry[] = [];

  // Track seen couples across ALL tables — WDSF shows one table per round
  // (Final=6, 1/2 Final=6, 1/4 Final=12, …) each with its own local rank 1-N.
  // We deduplicate and assign a GLOBAL rank counter so compare tab shows 1, 2, 3… not 1,2,3,4,5,6,1,2,3…
  const seenCoupleNames = new Set<string>();
  let globalRank = 0;

  $("table").each((_, table) => {
    const $t = $(table);
    const headers = $t.find("thead th, thead td").map((_, el) =>
      $(el).text().trim().toLowerCase()
    ).get();

    // Must have at least a couple/name column or athlete links in rows
    const hasCouple = headers.some(h =>
      h.includes("couple") || h.includes("athlete") || h.includes("name")
    );
    const hasStart = headers.some(h =>
      h.includes("start") || h === "st." || h === "nr." || h === "nr" || h === "no."
    );
    // Accept table if it has athlete links even if headers don't match
    const hasAthleteLinks = $t.find('a[href*="/Athletes/"]').length > 0;
    if (!hasCouple && !hasStart && !hasAthleteLinks) return;

    // Identify column indices — "start #" must NOT match a pure "#" rank column
    const idxCouple  = headers.findIndex(h =>
      h.includes("couple") || h.includes("athlete") || h.includes("name")
    );
    // "start #" or "st." but NOT a bare "#" which is usually rank
    const idxStart   = headers.findIndex(h =>
      h.includes("start") || h === "st." || h === "nr." || h === "nr" || h === "no."
    );
    const idxCountry = headers.findIndex(h =>
      h.includes("country") || h.includes("nation") || h === "cnt" || h === "ctr"
    );
    const idxPoints  = headers.findIndex(h =>
      h.includes("point") || h.includes("score") || h.includes("pts")
    );

    $t.find("tbody tr").each((_, row) => {
      const $row = $(row);
      const cells = $row.find("td").map((_, td) => $(td).text().trim()).get();
      if (cells.length < 2) return;

      // Athlete links → extract names and URLs
      const athleteUrls: string[] = [];
      const nameFromLinks: string[] = [];
      $row.find('a[href*="/Athletes/"]').each((_, a) => {
        const href = $(a).attr("href") ?? "";
        const full = href.startsWith("http") ? href : `${WDSF_BASE}${href}`;
        athleteUrls.push(full);
        const text = $(a).text().trim();
        if (text) nameFromLinks.push(text);
      });

      // Couple name: prefer links (most reliable), then cell text
      let coupleName = nameFromLinks.length
        ? nameFromLinks.join(" - ")
        : idxCouple >= 0 ? cells[idxCouple] ?? "" : cells[0] ?? "";
      coupleName = coupleName.trim();
      if (!coupleName) return;

      // Deduplication: WDSF shows the same couple in each round table it competed in.
      // Keep only the FIRST appearance (= best result / highest-ranked table).
      const nameKey = coupleName.toLowerCase().replace(/\s+/g, " ");
      if (seenCoupleNames.has(nameKey)) return;
      seenCoupleNames.add(nameKey);

      globalRank++;

      // Couple number: look for Start # column; fall back to scanning first 5 cells
      let coupleNumber = idxStart >= 0 ? (cells[idxStart] ?? "").trim() : "";
      if (!coupleNumber || !/^\d+$/.test(coupleNumber)) {
        // Scan first 5 cells for a pure numeric value that looks like a start number (1–999)
        for (let i = 0; i < Math.min(5, cells.length); i++) {
          const v = cells[i].trim();
          if (/^\d{1,3}$/.test(v) && parseInt(v) >= 1 && parseInt(v) <= 999) {
            // Make sure it's not the rank value we already computed
            if (parseInt(v) !== globalRank) {
              coupleNumber = v;
              break;
            }
          }
        }
      }

      const country = idxCountry >= 0 ? (cells[idxCountry] ?? "").trim() : "";
      const points  = idxPoints  >= 0 ? (cells[idxPoints]  ?? "").trim() : "";

      entries.push({
        rank: globalRank,
        coupleName,
        country,
        coupleNumber,
        points,
        athleteUrls,
      });
    });
  });

  return { competitionName, entries };
}

// ─── Marks page scraper ───────────────────────────────────────────────────────

/** Normalize a cell value to a plain integer string — strips leading zeros, dots, spaces */
function normNum(v: string): string {
  const clean = v.trim().replace(/[.\s]/g, "");
  return clean.replace(/^0+/, "") || "0";
}

/**
 * Scan first maxCol cells of a row for the couple number. Returns column index or -1.
 * skipIndices: known non-couple columns (e.g. rank, round) that should never match.
 */
function rowHasCoupleNum(
  cells: string[],
  coupleNumber: string,
  maxCol = 5,
  skipIndices: Set<number> = new Set(),
): number {
  const target = normNum(coupleNumber);
  for (let i = 0; i < Math.min(maxCol, cells.length); i++) {
    if (skipIndices.has(i)) continue;
    const raw = cells[i].trim();
    // Must be a numeric-only cell (possibly with leading zeros or trailing dot)
    if (!/^\d+\.?$/.test(raw)) continue;
    if (normNum(raw) === target) return i;
  }
  return -1;
}

async function scrapeMarksPage(
  marksUrl: string,
  coupleNumber: string,
  coupleName: string,
): Promise<PrelimRound[]> {
  const res = await fetch(marksUrl, { headers: FETCH_HEADERS });
  if (!res.ok) return [];
  const html = await res.text();
  const $ = load(html);

  const rounds: PrelimRound[] = [];
  const seenRounds = new Set<number>();

  const danceWords = [
    "waltz", "tango", "foxtrot", "quickstep", "viennese",
    "cha", "samba", "rumba", "paso", "jive", "polka", "blues",
    "slow fox", "v. waltz", "q.step",
  ];

  // Build a map: table element → preceding heading text, so we can detect final tables.
  const tablePrevHeading = new Map<Element, string>();
  {
    let curHeading = "";
    $("h1, h2, h3, h4, h5, h6, table, caption").each((_, el) => {
      if ($(el).is("table")) {
        tablePrevHeading.set(el as Element, curHeading);
      } else {
        const t = $(el).text().trim();
        if (t && t.length < 120) curHeading = t;
      }
    });
  }

  // Regex that matches "Final" but not "Semi-Final", "Quarter-Final", "1/2 Final", etc.
  const FINAL_HEADING_RE = /\bfinal\b/i;
  const QUALIFYING_PREFIX_RE = /\b(semi|quarter|1\/2|1\/4|preliminary|prelim)\b/i;

  $("table").each((_, table) => {
    const $t = $(table);
    const hdrText = $t.find("thead").text().toLowerCase();

    if (!danceWords.some(d => hdrText.includes(d))) return;

    // Skip tables whose preceding heading indicates the Final round
    const prevHeading = tablePrevHeading.get(table as Element) ?? "";
    if (FINAL_HEADING_RE.test(prevHeading) && !QUALIFYING_PREFIX_RE.test(prevHeading)) return;
    // Also skip if the table caption itself says "final"
    const captionText = $t.find("caption").text();
    if (FINAL_HEADING_RE.test(captionText) && !QUALIFYING_PREFIX_RE.test(captionText)) return;

    const colMap = buildMarkColumnMap($t, $);

    // Determine which column to use for "couple", "round", and "rank"
    const coupleCellIdx = colMap.findIndex(c => c.type === "couple");
    const roundCellIdx  = colMap.findIndex(c => c.type === "round");
    const rankCellIdx   = colMap.findIndex(c => c.type === "rank");

    // When falling back to rowHasCoupleNum (no couple column identified), skip
    // known non-couple columns so we don't match rank or round values.
    const fallbackSkipIndices = new Set<number>(
      [rankCellIdx, roundCellIdx].filter(i => i >= 0)
    );

    // WDSF uses rowspan on the Rank and Couple columns so that for round 2, 3, …
    // of the same couple those cells are absent from the row. We track whether we
    // are inside such a "continuation block" for our target couple.
    let trackingCouple = false;
    const expectedCellCount = colMap.length; // logical column count from thead

    $t.find("tbody tr").each((rowIdx, row) => {
      const rawCells = $(row).find("td").toArray();
      if (!rawCells.length) return;
      const cells = rawCells.map(td => $(td).text().trim());

      // How many logical columns are missing due to rowspan in the first row of
      // this couple group (e.g. Rank + Couple = 2 cols → shift = 2).
      // Cap at 5: larger deficits mean a colspan header/footer row, not a continuation.
      const deficit = expectedCellCount - cells.length;
      const rowspanShift = (deficit > 0 && deficit <= 5) ? deficit : 0;
      const isContinuation = rowspanShift > 0;

      // ── Couple matching ──────────────────────────────────────────────────
      let coupleFound = false;

      if (isContinuation) {
        // Rank/Couple cells are rowspanned from the "anchor" row above.
        // Trust the tracking flag set when we found the anchor row.
        coupleFound = trackingCouple;
      } else {
        // Full row — reset tracking, then check if this is our couple.
        trackingCouple = false;
        if (coupleCellIdx >= 0) {
          // Couple column identified in header — use it exclusively (no fallback scan,
          // which would create false positives from rank/draw columns with the same number).
          coupleFound = normNum(cells[coupleCellIdx]) === normNum(coupleNumber);
        } else {
          // No couple column identified — scan first few cells as a fallback,
          // but skip known rank/round columns to avoid false positives.
          coupleFound = rowHasCoupleNum(cells, coupleNumber, 4, fallbackSkipIndices) >= 0;
        }
        if (coupleFound) trackingCouple = true;
      }

      if (!coupleFound) return;

      // ── Round number ─────────────────────────────────────────────────────
      // In continuation rows the Round column index shifts left by rowspanShift
      // (because the rowspanned cols are not present in rawCells).
      // When there is no Round column at all, fall back to rounds.length + 1.
      let roundNum: number;
      const adjustedRoundIdx = roundCellIdx >= 0 ? roundCellIdx - rowspanShift : -1;
      if (adjustedRoundIdx >= 0 && adjustedRoundIdx < cells.length) {
        const rawRoundStr = cells[adjustedRoundIdx].trim();
        // Skip rows whose round column explicitly labels this as the Final
        if (/^f$/i.test(rawRoundStr) || /\bfinal\b/i.test(rawRoundStr)) return;
        roundNum = parseInt(rawRoundStr, 10);
        if (isNaN(roundNum) || roundNum < 1 || roundNum > 30) {
          // Round column exists but value isn't a valid round number (e.g. "Total", "Sum" rows,
          // or a spurious large number from reading the wrong column) — skip.
          if (roundCellIdx >= 0) return;
          roundNum = rounds.length + 1;
        }
      } else {
        roundNum = rounds.length + 1;
      }

      if (seenRounds.has(roundNum)) return;
      seenRounds.add(roundNum);

      // ── Judge marks ───────────────────────────────────────────────────────
      const danceBuckets: Record<string, JudgeCross[]> = {};
      colMap.forEach((col, idx) => {
        if (col.type !== "judge" || !col.dance || !col.judge) return;
        const adjustedIdx = idx - rowspanShift;
        if (adjustedIdx < 0 || adjustedIdx >= rawCells.length) return;
        const cell = rawCells[adjustedIdx];
        if (!cell) return;
        const raw = $(cell).text().trim();
        if (!danceBuckets[col.dance]) danceBuckets[col.dance] = [];
        danceBuckets[col.dance].push({ judge: col.judge, marked: isCross(raw) });
      });

      let dances: DancePrelimMarks[] = Object.entries(danceBuckets).map(([dance, crosses]) => ({
        dance,
        crosses,
        totalCrosses: crosses.filter(c => c.marked).length,
      }));

      // Fallback: use per-dance total (= column) if individual judge columns weren't parsed
      if (!dances.length) {
        colMap.forEach((col, idx) => {
          if (col.type !== "danceTotal" || !col.dance) return;
          const adjustedIdx = idx - rowspanShift;
          if (adjustedIdx < 0 || adjustedIdx >= rawCells.length) return;
          const cell = rawCells[adjustedIdx];
          if (!cell) return;
          const total = parseInt($(cell).text().trim(), 10);
          if (!isNaN(total)) {
            dances.push({ dance: col.dance, crosses: [], totalCrosses: total });
          }
        });
      }

      // Skip rows with no parseable judge data (header/total rows that slipped through)
      if (dances.length === 0) return;

      rounds.push({
        roundNumber: roundNum,
        dances,
        totalCrosses: dances.reduce((s, d) => s + d.totalCrosses, 0),
      });
    });
  });

  return rounds.sort((a, b) => a.roundNumber - b.roundNumber);
}

// ─── Officials page scraper ───────────────────────────────────────────────────

async function scrapeOfficialsPage(officialsUrl: string): Promise<Record<string, string>> {
  try {
    const res = await fetch(officialsUrl, { headers: FETCH_HEADERS });
    if (!res.ok) return {};
    const $ = load(await res.text());
    const judgeMap: Record<string, string> = {};

    $("table").each((_, table) => {
      const $t = $(table);
      const headers = $t.find("thead th, thead td").map((_, el) =>
        $(el).text().trim().toLowerCase()
      ).get();

      const idxName = headers.findIndex(h =>
        h === "name" || h === "full name" || h === "fullname" ||
        h.includes("adjudicator") || h.includes("judge")
      );
      const idxIdentifier = headers.findIndex(h =>
        h === "identifier" || h === "letter" || h === "code" ||
        h === "sign" || h === "abbr" || h === "id" || h === "nr" || h === "no"
      );
      if (idxName < 0 || idxIdentifier < 0) return;

      $t.find("tbody tr").each((_, row) => {
        const cells = $(row).find("td").map((_, td) => $(td).text().trim()).get();
        const name   = cells[idxName]?.trim() ?? "";
        const letter = cells[idxIdentifier]?.trim() ?? "";
        if (name && letter) judgeMap[letter] = name;
      });
    });

    return judgeMap;
  } catch {
    return {};
  }
}

// ─── Final page scraper ───────────────────────────────────────────────────────

const FINAL_DANCE_RE = /viennese\s+waltz|slow\s+foxtrot|cha.?cha|waltz|tango|foxtrot|quickstep|samba|rumba|paso\s+doble|jive|polka/i;

async function scrapeFinalPage(finalUrl: string, coupleNumber: string): Promise<FinalResult | null> {
  const res = await fetch(finalUrl, { headers: FETCH_HEADERS });
  if (!res.ok) return null;
  const $ = load(await res.text());

  // For System 3.0 competitions WDSF serves the same page at /Final/ and /Scores/.
  // The 3.0 data is parsed by scrapeScoresPage (→ final3); this skating-system parser
  // must NOT run on it, otherwise it picks up a place from any round's summary table
  // and wrongly reports a non-finalist as having reached the final.
  if ($("table.js-scores").length > 0 || /Component score/.test($("body").text())) return null;

  // Map each <table> to the dance name announced by the nearest preceding heading
  const tableDanceMap = new Map<Element, string>();
  {
    let cur = "";
    $("h2, h3, h4, h5, table").each((_, el) => {
      if ($(el).is("table")) {
        tableDanceMap.set(el as Element, cur);
      } else {
        const t = $(el).text().trim();
        if (t) cur = t;
      }
    });
  }

  const danceResults: FinalDanceResult[] = [];
  let overallPlace = 0;

  $("table").each((_, table) => {
    const $t       = $(table);
    const danceName = tableDanceMap.get(table as Element) ?? "";
    const theadText = $t.find("thead").text();
    const sourceText = danceName || theadText;

    const isRuleNine = /sum|rule.?9|resolved/i.test(sourceText)
      || /sum|resolved/i.test(theadText);
    const danceMatch = isRuleNine ? null : sourceText.match(FINAL_DANCE_RE);

    if (!danceMatch) {
      // Summary / Rule 9 table — extract overall place for this couple
      const headers: string[] = [];
      $t.find("thead th, thead td").each((_, el) => { headers.push($(el).text().trim().toLowerCase()); });
      let placeColIdx = -1;
      for (let i = headers.length - 1; i >= 0; i--) {
        if (headers[i] === "place" || headers[i] === "rank") { placeColIdx = i; break; }
      }

      $t.find("tbody tr").each((_, row) => {
        const cells = $(row).find("td").map((_, td) => $(td).text().trim()).get();
        if (!cells.length || rowHasCoupleNum(cells, coupleNumber, 3) < 0) return;

        if (placeColIdx >= 0 && placeColIdx < cells.length) {
          const p = parseInt(cells[placeColIdx], 10);
          if (!isNaN(p) && p >= 1) overallPlace = p;
        } else {
          // Scan last 4 cells for a place 1–6
          for (let i = cells.length - 1; i >= Math.max(0, cells.length - 4); i--) {
            const p = parseInt(cells[i], 10);
            if (!isNaN(p) && p >= 1 && p <= 6) { overallPlace = p; break; }
          }
        }
      });
      return;
    }

    // Per-dance final table (single-row thead: Couple | judge letters | Place colspan=N)
    const judgeColMap: { letter: string; colIdx: number }[] = [];
    let ci = 0;
    $t.find("thead tr").first().find("th, td").each((_, th) => {
      const raw     = $(th).text().trim();
      const lower   = raw.toLowerCase();
      const colspan = parseInt($(th).attr("colspan") ?? "1", 10);
      // Skip non-judge columns: empty, known keyword headers, and anything with no
      // alphabetic character (e.g. "1.", "2." positional columns that are not judge codes).
      if (raw && /[a-zA-Z]/.test(raw) && lower !== "couple" && lower !== "place" && lower !== "rank" && lower !== "#" && lower !== "nr" && lower !== "total" && lower !== "sum") {
        judgeColMap.push({ letter: raw, colIdx: ci });
      }
      ci += colspan;
    });

    $t.find("tbody tr").each((_, row) => {
      const rawCells  = $(row).find("td").toArray();
      if (!rawCells.length) return;
      const cellTexts = rawCells.map(td => $(td).text().trim());
      if (rowHasCoupleNum(cellTexts, coupleNumber, 3) < 0) return;

      const judgeEntries: FinalJudgePlacement[] = [];
      for (const { letter, colIdx } of judgeColMap) {
        if (colIdx >= rawCells.length) continue;
        const place = parseInt(cellTexts[colIdx].replace(/\.$/, ""), 10);
        if (!isNaN(place) && place >= 1 && place <= 6) {
          judgeEntries.push({ judge: letter, place });
        }
      }

      // Dance place: last numeric 1–6 in the row (skating result)
      let dancePlace = 0;
      for (let i = cellTexts.length - 1; i >= 0; i--) {
        const p = parseInt(cellTexts[i].replace(/\.$/, ""), 10);
        if (!isNaN(p) && p >= 1 && p <= 6) { dancePlace = p; break; }
      }

      const canonical = danceMatch[0].replace(/\b\w/g, c => c.toUpperCase());
      danceResults.push({ dance: canonical, judgeEntries, dancePlace });
    });
  });

  if (!danceResults.length && !overallPlace) return null;

  const judgeMap: Record<string, number[]> = {};
  for (const dr of danceResults) {
    for (const je of dr.judgeEntries) {
      if (!judgeMap[je.judge]) judgeMap[je.judge] = [];
      judgeMap[je.judge].push(je.place);
    }
  }
  const judgeAvgPlaces = Object.entries(judgeMap)
    .filter(([judge]) => judge && /[a-zA-Z]/.test(judge))
    .map(([judge, places]) => ({
      judge,
      avgPlace: places.reduce((s, p) => s + p, 0) / places.length,
    }))
    .sort((a, b) => a.avgPlace - b.avgPlace);

  return { dances: danceResults, overallPlace, judgeAvgPlaces };
}

// ─── System 3.0 Scores page scraper ──────────────────────────────────────────

/** Returns true for the true Final round (not Semi/Quarter/prelim numbered rounds). */
function isTrueFinalRound(roundName: string): boolean {
  const n = roundName.trim().toLowerCase();
  // "Final" alone, or "Final Round" — but NOT "Semi-Final", "Quarter-Final", "5. Round", etc.
  return /^final/.test(n) && !/semi|quarter|1\/[24]|\d/.test(n);
}

// Matches headings that represent competition rounds (not just dance names or rule tables)
const ROUND_HEADING_RE = /\bfinal\b|\bsemi\b|\bquarter\b|\bsf\b|\bqf\b|\d+\.?\s*round\b|\bround\s*\d+/i;

/** Canonical dance name from a heading/header cell, or "" if not a dance. */
function canonDanceName(s: string): string {
  const t = s.trim();
  if (/cha.?cha/i.test(t)) return "Cha Cha Cha";
  const m = t.match(FINAL_DANCE_RE);
  if (!m) return "";
  return m[0].replace(/\b\w/g, c => c.toUpperCase());
}

function emptyScore3Components(): Score3Components {
  return { tqPs: null, mmCp: null, tq: null, mm: null, ps: null, cp: null };
}

/**
 * Parse one couple's per-dance adjudicator table (the nested table inside a
 * tr.coupleInfo row). Handles both column layouts:
 *   2-column: Adjudicator | TQ & PS | MM & CP | Result
 *   4-column: Adjudicator | TQ | MM | PS | CP | Result
 * Each adjudicator scores exactly one area, so the other cells are blank.
 */
function parseAdjudicatorTable(
  $: CheerioAPI,
  $at: Cheerio<Element>,
): { judgeEntries: Score3JudgeEntry[]; components: Score3Components; totalScore: number; fourCriteria: boolean } {
  // ── Locate criteria columns from the 2-row thead (rowspan/colspan aware) ──
  let tqPsIdx = -1, mmCpIdx = -1, tqIdx = -1, mmIdx = -1, psIdx = -1, cpIdx = -1;
  {
    const headRows = $at.find("thead tr").toArray();
    const occupied = new Set<number>();
    for (let ri = 0; ri < headRows.length; ri++) {
      let ci = 0;
      $(headRows[ri]).find("th, td").each((_, th) => {
        while (occupied.has(ci)) ci++;
        const colspan = parseInt($(th).attr("colspan") ?? "1", 10);
        const rowspan = parseInt($(th).attr("rowspan") ?? "1", 10);
        const t = $(th).text().replace(/ /g, " ").trim().toUpperCase().replace(/\s+/g, " ");
        if      (t === "TQ & PS") tqPsIdx = ci;
        else if (t === "MM & CP") mmCpIdx = ci;
        else if (t === "TQ")      tqIdx = ci;
        else if (t === "MM")      mmIdx = ci;
        else if (t === "PS")      psIdx = ci;
        else if (t === "CP")      cpIdx = ci;
        if (rowspan > 1) for (let k = 0; k < colspan; k++) occupied.add(ci + k);
        ci += colspan;
      });
    }
  }
  const fourCriteria = tqIdx >= 0 || psIdx >= 0 || cpIdx >= 0;
  // Fallbacks when headers could not be located
  if (!fourCriteria) {
    if (tqPsIdx < 0) tqPsIdx = 1;
    if (mmCpIdx < 0) mmCpIdx = 2;
  }

  const get = (cells: string[], idx: number): number | null => {
    if (idx < 0 || idx >= cells.length) return null;
    const n = parseFloat(cells[idx]);
    return isNaN(n) ? null : n;
  };
  const cellsOf = (row: Element): string[] =>
    $(row).find("td:not(.total)").map((_, td) => $(td).text().replace(/ /g, " ").trim()).get();

  // ── Dance total (td.total carries a rowspan over all judge rows) ──
  let totalScore = 0;
  const totalTxt = $at.find("td.total").first().text().replace(/ /g, " ").trim();
  if (totalTxt) { const n = parseFloat(totalTxt); if (!isNaN(n)) totalScore = n; }

  // ── Per-judge rows ──
  const judgeEntries: Score3JudgeEntry[] = [];
  $at.find("tbody tr").each((_, row) => {
    const cells = cellsOf(row);
    if (cells.length < 2) return;
    const name = cells[0]?.trim() ?? "";
    if (!name || /component|result/i.test(name)) return;
    if (!/[a-zA-Z]/.test(name)) return;

    const entry: Score3JudgeEntry = {
      judge: name, tqPs: null, mmCp: null, tq: null, mm: null, ps: null, cp: null, rank: 0,
    };
    if (fourCriteria) {
      entry.tq = get(cells, tqIdx);
      entry.mm = get(cells, mmIdx);
      entry.ps = get(cells, psIdx);
      entry.cp = get(cells, cpIdx);
    } else {
      entry.tqPs = get(cells, tqPsIdx);
      entry.mmCp = get(cells, mmCpIdx);
    }
    const has = entry.tqPs != null || entry.mmCp != null ||
                entry.tq != null || entry.mm != null || entry.ps != null || entry.cp != null;
    if (!has) return;
    judgeEntries.push(entry);
  });

  // ── Component score row (tfoot) ──
  const components = emptyScore3Components();
  const foot = $at.find("tfoot tr").first();
  if (foot.length) {
    const cells = foot.find("td").map((_, td) => $(td).text().replace(/ /g, " ").trim()).get();
    if (fourCriteria) {
      components.tq = get(cells, tqIdx);
      components.mm = get(cells, mmIdx);
      components.ps = get(cells, psIdx);
      components.cp = get(cells, cpIdx);
    } else {
      components.tqPs = get(cells, tqPsIdx);
      components.mmCp = get(cells, mmCpIdx);
    }
  }

  return { judgeEntries, components, totalScore, fourCriteria };
}

/**
 * Scrape the System 3.0 "Scores" page. Structure (one section per round):
 *   <h2>Final</h2>  (or "4. Round", "Semi-Final", …)
 *   <table class="js-scores scores">
 *     thead: Couple | <dance>* | Total | Place
 *     tbody: for each couple — one summary <tr class="couple"> (per-dance totals,
 *            total, place) followed by hidden <tr class="dance_<num>_<i> coupleInfo">
 *            detail rows, each holding one dance's adjudicator table.
 * Only the Final round's summary table fills the Place column.
 */
async function scrapeScoresPage(
  scoresUrl: string,
  coupleNumber: string,
): Promise<{ prelim: Scores3Result | null; final3: Score3Round | null }> {
  const empty = { prelim: null, final3: null };
  const res = await fetch(scoresUrl, { headers: FETCH_HEADERS });
  if (!res.ok) return empty;
  return parseScoresHtml(await res.text(), coupleNumber);
}

/** Pure parser for the System 3.0 Scores page HTML (separated for testability). */
export function parseScoresHtml(
  html: string,
  coupleNumber: string,
): { prelim: Scores3Result | null; final3: Score3Round | null } {
  const empty = { prelim: null, final3: null };
  const $ = load(html);

  // Must contain decimal judge scores to be a System 3.0 page
  if (!/\d+\.\d+/.test($("body").text())) return empty;

  // Map each outer scores table to its preceding round heading
  const tableRoundMap = new Map<Element, string>();
  {
    let curRound = "";
    $("h1, h2, h3, h4, h5, table.js-scores").each((_, el) => {
      if ($(el).is("table")) {
        tableRoundMap.set(el as Element, curRound);
      } else {
        const t = $(el).text().trim();
        if (t && t.length < 40 && ROUND_HEADING_RE.test(t)) curRound = t;
      }
    });
  }

  const roundData: Record<string, { dances: Score3Dance[]; overallPlace: number }> = {};
  const ensureRound = (r: string) => {
    if (!roundData[r]) roundData[r] = { dances: [], overallPlace: 0 };
    return roundData[r];
  };
  const upsertDance = (
    round: { dances: Score3Dance[]; overallPlace: number },
    dance: string,
    patch: Partial<Score3Dance>,
  ): void => {
    let d = round.dances.find(x => x.dance === dance);
    if (!d) {
      d = { dance, judgeEntries: [], place: 0, totalMarks: 0, totalScore: 0,
            components: emptyScore3Components(), fourCriteria: false };
      round.dances.push(d);
    }
    Object.assign(d, patch);
  };

  // ── Pass 1: summary tables → per-dance totals + overall place ──
  $("table.js-scores").each((_, table) => {
    const $t = $(table);
    const roundName = tableRoundMap.get(table as Element) ?? "";
    if (!roundName) return;
    const round = ensureRound(roundName);

    // Parse the (single-row) summary header for column positions
    const danceCols: { dance: string; colIdx: number }[] = [];
    let coupleColIdx = -1, totalColIdx = -1, placeColIdx = -1;
    {
      const headRow = $t.children("thead").children("tr").first();
      let ci = 0;
      headRow.children("th, td").each((_, th) => {
        const cls = $(th).attr("class") ?? "";
        const txt = $(th).text().trim();
        const colspan = parseInt($(th).attr("colspan") ?? "1", 10);
        if      (/\bcouple\b/.test(cls)) coupleColIdx = ci;
        else if (/\bplace\b/.test(cls))  placeColIdx = ci;
        else if (/\btotal\b/.test(cls))  totalColIdx = ci;
        else if (/\bdance\b/.test(cls))  danceCols.push({ dance: txt, colIdx: ci });
        ci += colspan;
      });
      // Fallback: derive columns positionally when classes are absent
      if (coupleColIdx < 0) coupleColIdx = 0;
      if (!danceCols.length) {
        let cj = 0;
        headRow.children("th, td").each((_, th) => {
          const txt = $(th).text().trim();
          const colspan = parseInt($(th).attr("colspan") ?? "1", 10);
          const canon = canonDanceName(txt);
          if (canon) danceCols.push({ dance: txt, colIdx: cj });
          cj += colspan;
        });
      }
    }

    $t.children("tbody").children("tr.couple").each((_, row) => {
      const cells = $(row).children("td").map((_, td) => $(td).text().trim()).get();
      if (!cells.length) return;
      const num = coupleColIdx < cells.length ? cells[coupleColIdx] : cells[0];
      if (normNum(num) !== normNum(coupleNumber)) return;

      for (const { dance, colIdx } of danceCols) {
        const canonical = canonDanceName(dance);
        if (!canonical) continue;
        const val = colIdx < cells.length ? parseFloat(cells[colIdx]) : NaN;
        upsertDance(round, canonical, { totalScore: isNaN(val) ? 0 : val });
      }

      // Overall place — present only in the Final round summary
      if (placeColIdx >= 0 && placeColIdx < cells.length) {
        const p = parseInt(cells[placeColIdx], 10);
        if (!isNaN(p) && p >= 1) round.overallPlace = p;
      }
      void totalColIdx;
    });
  });

  // ── Pass 2: per-couple per-dance adjudicator tables ──
  $("tr.coupleInfo").each((_, infoRow) => {
    const $ir = $(infoRow);
    const cls = $ir.attr("class") ?? "";
    const cm = cls.match(/dance_(\d+)_\d+/);
    if (!cm || normNum(cm[1]) !== normNum(coupleNumber)) return;

    const outer = $ir.closest("table.js-scores").get(0);
    if (!outer) return;
    const roundName = tableRoundMap.get(outer as Element) ?? "";
    if (!roundName) return;
    const round = ensureRound(roundName);

    const canonical = canonDanceName($ir.find("h3").first().text());
    if (!canonical) return;

    const $at = $ir.find("table").first();
    if (!$at.length) return;

    const parsed = parseAdjudicatorTable($, $at);
    if (!parsed.judgeEntries.length && parsed.totalScore <= 0) return;

    upsertDance(round, canonical, {
      judgeEntries: parsed.judgeEntries,
      components: parsed.components,
      fourCriteria: parsed.fourCriteria,
      ...(parsed.totalScore > 0 ? { totalScore: parsed.totalScore } : {}),
    });
  });

  // ── Split Final vs prelim rounds ──
  let final3: Score3Round | null = null;
  const prelimRounds: Score3Round[] = [];
  for (const [roundName, { dances, overallPlace }] of Object.entries(roundData)) {
    if (!dances.length) continue;
    const round: Score3Round = { roundName, dances, overallPlace };
    if (isTrueFinalRound(roundName)) final3 = round;
    else prelimRounds.push(round);
  }

  prelimRounds.sort((a, b) => {
    const num = (s: string) => { const m = s.match(/(\d+)/); return m ? parseInt(m[1]) : 0; };
    return num(a.roundName) - num(b.roundName);
  });

  const prelim = prelimRounds.length ? { rounds: prelimRounds } : null;
  return { prelim, final3 };
}

// ─── Main analytics scraper ───────────────────────────────────────────────────

export async function scrapeCompetitionAnalytics(
  competitionUrl: string,
  athleteUuid: string,
): Promise<CompetitionAnalytics> {
  const urls = buildCompUrls(competitionUrl);

  // Step 1: Ranking page → find couple number + all couples
  const { competitionName, entries } = await scrapeRankingPage(urls.ranking);

  const myEntry = entries.find(e =>
    e.athleteUrls.some(u => u.toLowerCase().includes(athleteUuid.toLowerCase()))
  );
  if (!myEntry) {
    throw new Error(`Athlete UUID ${athleteUuid} not found in competition ranking`);
  }

  const coupleNumber = myEntry.coupleNumber;
  const coupleName   = myEntry.coupleName;

  // Step 2: Marks + Final + Scores (3.0) + Officials (parallel)
  const [rounds, final, { prelim: scores3, final3 }, judgeNames] = await Promise.all([
    scrapeMarksPage(urls.marks, coupleNumber, coupleName),
    scrapeFinalPage(urls.final, coupleNumber),
    scrapeScoresPage(urls.scores, coupleNumber),
    scrapeOfficialsPage(urls.officials),
  ]);

  // Step 3: Compute dance stats
  const danceMap: Record<string, number[]> = {};
  for (const round of rounds) {
    for (const d of round.dances) {
      if (!danceMap[d.dance]) danceMap[d.dance] = [];
      danceMap[d.dance].push(d.totalCrosses);
    }
  }
  const danceStats = Object.entries(danceMap).map(([dance, vals]) => ({
    dance,
    totalCrosses: vals.reduce((s, v) => s + v, 0),
    avgPerRound: vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0,
  })).sort((a, b) => b.totalCrosses - a.totalCrosses);

  // Step 4: Compute judge stats (prelim rounds)
  const judgeMap: Record<string, { total: number; possible: number }> = {};
  for (const round of rounds) {
    for (const d of round.dances) {
      for (const c of d.crosses) {
        if (!judgeMap[c.judge]) judgeMap[c.judge] = { total: 0, possible: 0 };
        judgeMap[c.judge].possible++;
        if (c.marked) judgeMap[c.judge].total++;
      }
    }
  }
  const totalRounds = rounds.length;
  const judgeStats = Object.entries(judgeMap)
    .filter(([judge, { possible }]) => {
      // Drop empty-string judge keys (parsing artifact)
      if (!judge) return false;
      // Drop purely non-alphabetic identifiers: "1.", "2." etc. are positional
      // column markers, not real judge codes. Real WDSF codes always contain letters.
      if (!/[a-zA-Z]/.test(judge)) return false;
      // Drop judges that appear in far fewer dances than expected —
      // typically these are phantom entries from a misidentified column.
      const minExpected = Math.max(1, totalRounds * 0.3);
      return possible >= minExpected;
    })
    .map(([judge, { total, possible }]) => ({
      judge,
      totalCrosses: total,
      pct: possible > 0 ? Math.round((total / possible) * 100) : 0,
    })).sort((a, b) => b.totalCrosses - a.totalCrosses);

  const totalPossible = judgeStats.reduce((s, j) => s + j.totalCrosses, 0);

  return {
    competitionSlug: urls.slug,
    competitionName,
    rankingUrl: urls.ranking,
    coupleNumber,
    coupleName,
    rounds,
    final,
    final3,
    scores3,
    danceStats,
    judgeStats,
    totalPossibleCrosses: totalPossible,
    // Reached the final only if the couple has actual Final-round dance data — not
    // merely an overall place picked up from a shared scores page.
    reachedFinal:
      (final3 !== null && final3.dances.length > 0) ||
      (final !== null && final.dances.length > 0),
    allCouples: entries,
    judgeNames,
  };
}

/**
 * Fetch the System 3.0 score breakdown (Final + prelim rounds) for ANY couple at a
 * competition, by start number. Used to compare the logged-in couple against a rival
 * — the Scores page already contains every couple's per-judge data.
 */
export async function scrapeCoupleScores(
  competitionUrl: string,
  coupleNumber: string,
): Promise<{ scores3: Scores3Result | null; final3: Score3Round | null }> {
  const urls = buildCompUrls(competitionUrl);
  const { prelim, final3 } = await scrapeScoresPage(urls.scores, coupleNumber);
  return { scores3: prelim, final3 };
}

// ─── Main profile scraper ─────────────────────────────────────────────────────

export async function scrapeAthleteProfile(profileUrl: string): Promise<WdsfProfile> {
  const uuid = extractUuid(profileUrl);
  if (!uuid) throw new Error("Invalid WDSF profile URL — no UUID found");

  const res = await fetch(profileUrl, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`WDSF fetch failed: HTTP ${res.status}`);
  const html = await res.text();
  const $ = load(html);

  function findValue(labels: string[]): string | null {
    const bodyText = $("body").text();
    for (const label of labels) {
      const cell = $("th, td, dt, strong, b, label, span").filter((_, el) => {
        const t = $(el).text().trim().replace(/[:\s]+$/, "");
        return t.toLowerCase() === label.toLowerCase();
      }).first();

      if (cell.length) {
        const next = cell.next("td, dd");
        if (next.length && next.text().trim()) return next.text().trim();
        const rowSib = cell.parent("tr").find("td").not(cell).first();
        if (rowSib.length && rowSib.text().trim()) return rowSib.text().trim();
      }

      const re = new RegExp(
        label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*[:\\(]?\\s*([^\\n]{1,100})",
        "i"
      );
      const m = bodyText.match(re);
      if (m?.[1]?.trim()) return m[1].split(/[\n\r]/)[0].trim();
    }
    return null;
  }

  const firstName = findValue(["Name", "First name", "Firstname"]) ?? "";
  const lastName  = findValue(["Surname", "Last name", "Lastname"])  ?? "";

  const h1Name = $("h1").first().text().trim();
  const name   = h1Name || [firstName, lastName].filter(Boolean).join(" ")
    || $("title").text().replace(/\s*[-|].*$/, "").trim();

  const min             = findValue(["Member Id number", "Member Id Number (MIN)", "MIN", "Member ID"]) ?? "";
  const nationality     = findValue(["Nationality"])           ?? "";
  const represents      = findValue(["Represents", "Country"]) ?? "";
  const ageGroup        = findValue(["Current age group", "Age group", "Age Group"]);
  const licenseDivision = findValue(["Division"]);
  const licenseStatus   = findValue(["Status"]);
  const licenseExpiry   = findValue(["Expiration date", "Expiry date", "Expiration", "Valid until"]);

  // ── Competition results ────────────────────────────────────────────────────

  const competitions: WdsfCompetition[] = [];

  $("table").each((_, table) => {
    const $t = $(table);
    const headers = $t.find("thead th, thead td").map((_, el) =>
      $(el).text().trim().toLowerCase()
    ).get();

    const isCompTable = headers.length >= 2 && headers.some(h =>
      h.includes("date") || h.includes("event") || h.includes("competition") || h.includes("rank")
    );
    if (!isCompTable) return;

    $t.find("tbody tr").each((_, row) => {
      const $row = $(row);
      const cells = $row.find("td").map((_, td) => $(td).text().trim()).get();
      if (cells.length < 2) return;

      const idx = (keywords: string[]) =>
        headers.findIndex(h => keywords.some(k => h.includes(k)));

      // Extract competition URL from any /Competitions/ link in this row
      let competitionUrl: string | null = null;
      $row.find('a[href*="/Competitions/"]').each((_, a) => {
        const href = $(a).attr("href") ?? "";
        if (href && !competitionUrl) {
          competitionUrl = href.startsWith("http") ? href : `${WDSF_BASE}${href}`;
        }
      });

      competitions.push({
        date:           cellAt(cells, idx(["date"]),                                  cells[0]),
        event:          cellAt(cells, idx(["event", "competition", "tournament"]),    cells[1]),
        location:       cellAt(cells, idx(["location", "city", "venue", "place"]),   ""),
        discipline:     cellAt(cells, idx(["discipline", "dance", "style"]),          ""),
        category:       cellAt(cells, idx(["category", "age group"]),                 ""),
        place:          cells[idx(["rank", "place", "result", "position"])] || null,
        points:         cells[idx(["point", "score"])]                      || null,
        competitionUrl,
      });
    });
  });

  // ── Partners ───────────────────────────────────────────────────────────────

  const partners: WdsfPartner[] = [];
  const seenPartnerUuids = new Set<string>();

  $("table").each((_, table) => {
    const $t = $(table);
    const headers = $t.find("thead th, thead td").map((_, el) =>
      $(el).text().trim().toLowerCase()
    ).get();

    const isPartnerTable = headers.some(h =>
      h === "partner" || h === "athlete" || h === "since" ||
      h.includes("partner") || h.includes("couple")
    );
    if (!isPartnerTable) return;

    $t.find("tbody tr").each((_, row) => {
      const $row = $(row);
      const cells = $row.find("td").map((_, td) => $(td).text().trim()).get();
      if (cells.length < 2) return;

      const idx = (keywords: string[]) =>
        headers.findIndex(h => keywords.some(k => h.includes(k)));

      let partnerName = "";
      let partnerHref: string | null = null;
      $row.find('a[href*="/Athletes/"]').each((_, a) => {
        const href = $(a).attr("href") ?? "";
        const pUuid = extractUuid(href);
        if (pUuid && pUuid !== uuid) {
          partnerName = $(a).text().trim();
          partnerHref = href.startsWith("http") ? href : `${WDSF_BASE}${href}`;
        }
      });
      if (!partnerName) partnerName = cells[idx(["partner", "athlete", "name"])] ?? cells[0] ?? "";

      const partnerUuid = partnerHref ? extractUuid(partnerHref) : null;
      if (partnerUuid && seenPartnerUuids.has(partnerUuid)) return;
      if (partnerUuid) seenPartnerUuids.add(partnerUuid);

      const nationalityI = idx(["nationality", "nation"]);
      const representsI  = idx(["represent", "country"]);
      const statusI      = idx(["status"]);
      const sinceI       = idx(["since", "from", "start"]);
      const untilI       = idx(["until", "to", "end", "retired"]);

      const statusText = cells[statusI] ?? "";
      const isCurrent  = statusText.toLowerCase().includes("active");

      partners.push({
        name:        partnerName,
        nationality: nationalityI >= 0 ? (cells[nationalityI] || null) : null,
        represents:  representsI  >= 0 ? (cells[representsI]  || null) : null,
        status:      isCurrent ? "current" : "former",
        since:       sinceI >= 0 ? (cells[sinceI]  || null) : null,
        until:       untilI >= 0 ? (cells[untilI]  || null) : null,
        profileUrl:  partnerHref,
      });
    });
  });

  if (partners.length === 0) {
    $('a[href*="/Athletes/"]').each((_, a) => {
      const href = $(a).attr("href") ?? "";
      const pUuid = extractUuid(href);
      if (!pUuid || pUuid === uuid || seenPartnerUuids.has(pUuid)) return;
      seenPartnerUuids.add(pUuid);

      const aName = $(a).text().trim();
      if (!aName) return;

      const parentText  = $(a).closest("tr, li, div").text().toLowerCase();
      const isCurrent   = parentText.includes("active") && !parentText.includes("retired");
      const dateMatches = parentText.match(/\d{2}\/\d{2}\/\d{4}/g) ?? [];

      partners.push({
        name:        aName,
        nationality: null,
        represents:  null,
        status:      isCurrent ? "current" : "former",
        since:       dateMatches[0] ?? null,
        until:       dateMatches[1] ?? null,
        profileUrl:  href.startsWith("http") ? href : `${WDSF_BASE}${href}`,
      });
    });
  }

  return {
    uuid,
    profileUrl,
    firstName:       firstName || name.split(" ")[0] || "",
    lastName:        lastName  || name.split(" ").slice(1).join(" ") || "",
    name,
    nationality,
    represents,
    min,
    ageGroup:        ageGroup        ?? null,
    licenseDivision: licenseDivision ?? null,
    licenseStatus:   licenseStatus   ?? null,
    licenseExpiry:   licenseExpiry   ?? null,
    photoUrl:        buildPhotoUrl(uuid),
    competitions:    competitions.slice(0, 100),
    partners,
    fetchedAt:       new Date().toISOString(),
  };
}

function cellAt(cells: string[], idx: number, fallback: string): string {
  return idx >= 0 ? (cells[idx] ?? fallback) : fallback;
}

// ─── MIN → UUID via sitemap search ───────────────────────────────────────────

export async function findAthleteUrlByName(
  firstName: string,
  lastName: string,
): Promise<string | null> {
  for (let i = 1; i <= 9; i++) {
    try {
      const res = await fetch(`${WDSF_BASE}/sitemapAthlete-${i}.xml`, { headers: FETCH_HEADERS });
      if (!res.ok) continue;
      const xml = await res.text();

      const re = new RegExp(
        `https://www\\.worlddancesport\\.org/Athletes/${escapeRegex(firstName)}-${escapeRegex(lastName)}-([0-9a-f-]{36})`,
        "i"
      );
      const m = xml.match(re);
      if (m) return m[0];
    } catch { /* skip */ }
  }
  return null;
}

export async function verifyAndScrape(
  profileUrl: string,
  expectedMin: string,
): Promise<WdsfProfile> {
  const profile = await scrapeAthleteProfile(profileUrl);
  if (profile.min && profile.min !== expectedMin) {
    throw new Error(`MIN mismatch: expected ${expectedMin}, got ${profile.min}.`);
  }
  return profile;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
