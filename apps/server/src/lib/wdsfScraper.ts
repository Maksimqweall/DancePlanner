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

export interface CompetitionAnalytics {
  competitionSlug: string;
  competitionName: string;
  rankingUrl: string;
  coupleNumber: string;
  coupleName: string;
  rounds: PrelimRound[];
  final: FinalResult | null;
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

/** Scan first maxCol cells of a row for the couple number. Returns column index or -1. */
function rowHasCoupleNum(cells: string[], coupleNumber: string, maxCol = 5): number {
  const target = normNum(coupleNumber);
  for (let i = 0; i < Math.min(maxCol, cells.length); i++) {
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

    // Determine which column to use for "couple" and "round"
    const coupleCellIdx = colMap.findIndex(c => c.type === "couple");
    const roundCellIdx  = colMap.findIndex(c => c.type === "round");

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
          // No couple column identified — scan first few cells as a fallback.
          coupleFound = rowHasCoupleNum(cells, coupleNumber, 4) >= 0;
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
        if (isNaN(roundNum) || roundNum < 1) {
          // Round column exists but value isn't a valid round number (e.g. "Total", "Sum" rows) — skip
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
      if (raw && lower !== "couple" && lower !== "place" && lower !== "rank" && lower !== "#" && lower !== "nr") {
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
    .map(([judge, places]) => ({
      judge,
      avgPlace: places.reduce((s, p) => s + p, 0) / places.length,
    }))
    .sort((a, b) => a.avgPlace - b.avgPlace);

  return { dances: danceResults, overallPlace, judgeAvgPlaces };
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

  // Step 2: Marks + Final + Officials (parallel)
  const [rounds, final, judgeNames] = await Promise.all([
    scrapeMarksPage(urls.marks, coupleNumber, coupleName),
    scrapeFinalPage(urls.final, coupleNumber),
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
      // Drop judges that appear in far fewer dances than expected —
      // typically these are phantom entries from a misidentified column.
      // A real judge should appear in at least one dance per round.
      // Allow some slack (0.3 threshold) for judges absent in early rounds.
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
    danceStats,
    judgeStats,
    totalPossibleCrosses: totalPossible,
    reachedFinal: final !== null,
    allCouples: entries,
    judgeNames,
  };
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
