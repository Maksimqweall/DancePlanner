import { load, type CheerioAPI } from "cheerio";
import type { Element } from "domhandler";
import {
  FETCH_HEADERS,
  computeAnalyticsStats,
  nameTokens,
  type CompetitionAnalytics,
  type PrelimRound,
  type DancePrelimMarks,
  type JudgeCross,
  type FinalResult,
  type FinalDanceResult,
  type FinalJudgePlacement,
  type RankingEntry,
} from "./wdsfScraper";

// ─── TopTurnier / TopTurnierDigital results scraper ────────────────────────────
//
// Almost every non-WDSF competition publishes results with TopTurnier. The result
// site is a frameset of static pages in one directory:
//   deck.htm     cover sheet  (title, date, judge A–I names)
//   erg.htm      results list  (final ranking + clubs)
//   ergwert.htm  ranking report — the richest page: per couple, per dance, per judge
//                the final placement + every qualifying-round cross, with an "R"
//                column listing which rounds the couple danced (e.g. "F/2/1").
//   wert_er.htm  final-round skating table
//   tabges.htm   overall scoring table
//
// We parse deck + ergwert + erg into the SAME `CompetitionAnalytics` shape the WDSF
// scraper produces, so the whole existing analytics UI is reused unchanged. System
// 3.0 scores don't exist in TopTurnier → `scores3`/`final3` are always null.

export class CoupleNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CoupleNotFoundError";
  }
}

export interface TopTurnierMeta {
  title: string;          // e.g. "DM, U21 S Latein"
  date: string | null;    // e.g. "15.03.2026"
  discipline: string | null; // "Latin" | "Standard" | null
  category: string | null;   // raw age-group label, e.g. "U21" | "Youth" | "Adult"
}

export interface TopTurnierResult {
  meta: TopTurnierMeta;
  analytics: CompetitionAnalytics;
}

// ─── URL handling ──────────────────────────────────────────────────────────────

/** Normalize any TopTurnier page/dir URL to the base directory + the page filenames. */
export function buildTopTurnierUrls(url: string): {
  base: string;
  deck: string; erg: string; ergwert: string; wert_er: string; tabges: string;
} {
  const clean = url.split("#")[0].split("?")[0].trim();
  // Drop a trailing *.htm / *.html filename; otherwise treat the URL as a directory.
  const base = /\.html?$/i.test(clean)
    ? clean.slice(0, clean.lastIndexOf("/") + 1)
    : clean.endsWith("/") ? clean : clean + "/";
  return {
    base,
    deck: base + "deck.htm",
    erg: base + "erg.htm",
    ergwert: base + "ergwert.htm",
    wert_er: base + "wert_er.htm",
    tabges: base + "tabges.htm",
  };
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: FETCH_HEADERS });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

// ─── Cell helpers ──────────────────────────────────────────────────────────────

/** Return a table cell's `<br>`-separated lines (decoded, trimmed, tooltips dropped). */
function cellLines($: CheerioAPI, el: Element): string[] {
  const $el = $(el).clone();
  $el.find("span").remove(); // drop tooltip spans
  const html = $el.html() ?? "";
  return html
    .split(/<br\s*\/?>/i)
    .map((part) => load(`<x>${part}</x>`)("x").text().replace(/ /g, " ").trim());
}

function isCrossMark(v: string): boolean {
  const t = v.trim().toLowerCase();
  return t === "x" || t === "×" || t === "*" || t === "+";
}

/** Parse a place token like "4." / "12.- 13." / "1,0" → the leading number. */
function parsePlace(v: string): number {
  const m = v.replace(",", ".").match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : 0;
}

// ─── Header parsing (dances + judges) ──────────────────────────────────────────

interface Judge { letter: string; name: string }

/** From ergwert's thead: ordered dance names + judge letters/names. */
function parseErgwertHeader($: CheerioAPI): { dances: string[]; judges: Judge[] } {
  const dances: string[] = [];
  const seenDance = new Set<string>();
  // Dance-name header cells carry colspan (one block of judge columns per dance).
  $("td.td2w[colspan], th.td2w[colspan]").each((_, el) => {
    const colspan = parseInt($(el).attr("colspan") ?? "1", 10);
    if (colspan <= 1) return;
    const name = $(el).clone().find("span").remove().end().text().trim();
    if (name && !seenDance.has(name)) { seenDance.add(name); dances.push(name); }
  });

  // Judge cells: the first contiguous run of single-letter td2w cells with a tooltip.
  const judges: Judge[] = [];
  const seen = new Set<string>();
  $("td.td2w, th.td2w").each((_, el) => {
    const letter = $(el).clone().find("span").remove().end().text().trim();
    const name = $(el).find("span").text().trim();
    if (/^[A-Z]$/i.test(letter) && name) {
      if (seen.has(letter)) return; // stop repeating once the next dance's A,B,C start
      seen.add(letter);
      judges.push({ letter: letter.toUpperCase(), name });
    }
  });
  return { dances, judges };
}

// ─── Couple-row parsing ────────────────────────────────────────────────────────

interface CoupleRow {
  place: number;
  placeLabel: string;
  coupleName: string;
  partners: string[];
  club: string;
  number: string;
  rounds: string[];          // R column, e.g. ["F","2","1"]
  // Per dance → per judge → the `<br>` lines aligned with `rounds`.
  danceJudgeLines: string[][][]; // [danceIdx][judgeIdx][roundIdx]
  danceSuLines: string[][];      // [danceIdx][roundIdx]
}

function parseCoupleRows($: CheerioAPI, numJudges: number, numDances: number): CoupleRow[] {
  const rows: CoupleRow[] = [];
  $("tr").each((_, tr) => {
    const $tr = $(tr);
    const nameCell = $tr.find("td.td5v").first();
    const numCell = $tr.find("td.td2cv").first();
    if (!nameCell.length || !numCell.length) return;

    const placeCell = $tr.find("td.td3cv").first();
    const rCell = $tr.find("td.td5c").first();
    const judgeCells = $tr.find("td.td5w").toArray();
    const suCells = $tr.find("td.td3www").toArray();
    if (!suCells.length || !judgeCells.length) return;

    const nameLines = cellLines($, nameCell[0]);
    const coupleName = nameLines[0] ?? "";
    const club = nameLines[1] ?? "";
    const partners = coupleName.split("/").map((p) => p.trim()).filter(Boolean);
    const rounds = rCell.length ? cellLines($, rCell[0]).filter(Boolean) : [];

    // Group the interleaved cells: numJudges judge cells then one Su cell per dance.
    const danceJudgeLines: string[][][] = [];
    const danceSuLines: string[][] = [];
    for (let d = 0; d < numDances; d++) {
      const judgeLines: string[][] = [];
      for (let j = 0; j < numJudges; j++) {
        const cell = judgeCells[d * numJudges + j];
        judgeLines.push(cell ? cellLines($, cell) : []);
      }
      danceJudgeLines.push(judgeLines);
      danceSuLines.push(suCells[d] ? cellLines($, suCells[d]) : []);
    }

    rows.push({
      place: placeCell.length ? parsePlace(placeCell.text()) : 0,
      placeLabel: placeCell.text().trim().replace(/\s+/g, " "),
      coupleName,
      partners,
      club,
      number: numCell.text().trim(),
      rounds,
      danceJudgeLines,
      danceSuLines,
    });
  });
  return rows;
}

// ─── Build the analytics for one couple ────────────────────────────────────────

function buildCoupleAnalytics(
  row: CoupleRow,
  dances: string[],
  judges: Judge[],
): { rounds: PrelimRound[]; final: FinalResult | null } {
  const finalIdx = row.rounds.indexOf("F");
  // Qualifying rounds = numeric labels in the R column (e.g. "2","1").
  const qualifying = row.rounds
    .map((label, idx) => ({ label, idx, num: parseInt(label, 10) }))
    .filter((r) => !isNaN(r.num));

  // ── Preliminary rounds (crosses per dance per judge) ──
  const rounds: PrelimRound[] = qualifying
    .map(({ idx, num }) => {
      const danceMarks: DancePrelimMarks[] = dances.map((dance, d) => {
        const crosses: JudgeCross[] = judges.map((jg, j) => {
          const lines = row.danceJudgeLines[d]?.[j] ?? [];
          return { judge: jg.letter, marked: isCrossMark(lines[idx] ?? "") };
        });
        return { dance, crosses, totalCrosses: crosses.filter((c) => c.marked).length };
      });
      return {
        roundNumber: num,
        dances: danceMarks,
        totalCrosses: danceMarks.reduce((s, d) => s + d.totalCrosses, 0),
      };
    })
    .sort((a, b) => a.roundNumber - b.roundNumber);

  // ── Final (per-dance judge placements) ──
  let final: FinalResult | null = null;
  if (finalIdx >= 0) {
    const danceResults: FinalDanceResult[] = dances.map((dance, d) => {
      const judgeEntries: FinalJudgePlacement[] = [];
      judges.forEach((jg, j) => {
        const lines = row.danceJudgeLines[d]?.[j] ?? [];
        const place = parseInt(lines[finalIdx] ?? "", 10);
        if (!isNaN(place) && place >= 1) judgeEntries.push({ judge: jg.letter, place });
      });
      const suLines = row.danceSuLines[d] ?? [];
      const dancePlace = parsePlace(suLines[finalIdx] ?? "");
      return { dance, judgeEntries, dancePlace };
    });

    const judgeMap: Record<string, number[]> = {};
    for (const dr of danceResults) {
      for (const je of dr.judgeEntries) {
        (judgeMap[je.judge] ??= []).push(je.place);
      }
    }
    const judgeAvgPlaces = Object.entries(judgeMap)
      .map(([judge, places]) => ({
        judge,
        avgPlace: places.reduce((s, p) => s + p, 0) / places.length,
      }))
      .sort((a, b) => a.avgPlace - b.avgPlace);

    final = { dances: danceResults, overallPlace: row.place, judgeAvgPlaces };
  }

  return { rounds, final };
}

// ─── Meta parsing (deck.htm) ───────────────────────────────────────────────────

function parseMeta(deckHtml: string | null, ergwertHtml: string): TopTurnierMeta {
  const readHeadline = ($: CheerioAPI): string => {
    const $head = $(".eventhead").first().clone();
    $head.find("a").remove(); // drop the ≡ back-button link
    return $head.text().replace(/[≡≡]/g, "").replace(/\s+/g, " ").trim();
  };
  const $deck = deckHtml ? load(deckHtml) : null;
  let headline = $deck ? readHeadline($deck) : "";
  if (!headline) headline = readHeadline(load(ergwertHtml));

  // Date can be "15.03.2026" (numeric) or "13/May/2023" (slash + month name).
  // Normalize the month-name form to "13 May 2023" so parseTournamentMonth reads it.
  let date: string | null = null;
  const named = headline.match(/(\d{1,2})[.\/\s]+([A-Za-z]{3,})[.\/\s]+(\d{2,4})/);
  const numeric = headline.match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/);
  if (named) date = `${named[1]} ${named[2]} ${named[3]}`;
  else if (numeric) date = `${numeric[1]}.${numeric[2]}.${numeric[3]}`;
  // Title = everything after the date/separator.
  let title = headline.replace(/^.*?[-–]\s*/, "").trim() || headline;
  if (!title) title = "Competition";

  const lower = title.toLowerCase();
  const discipline = /latein|latin/.test(lower) ? "Latin"
    : /standard|standart|ballroom/.test(lower) ? "Standard" : null;

  // Age-group label (best-effort, for display only).
  const ageMatch = title.match(/\bU\s?21\b|\bUnder\s?21\b|youth|jugend|junior(?:en)?\s?(ii|2|i|1)?|adult|hauptgruppe|senior(?:en)?\s?\w*|rising stars/i);
  const category = ageMatch ? ageMatch[0].trim() : null;

  return { title, date, discipline, category };
}

/**
 * Translate a (possibly German) TopTurnier title into tokens `combinedTypeFromText`
 * understands, so the field-rating can map to a WDSF World Ranking list.
 */
export function normalizeTitleForRanking(title: string): string {
  return title
    .toLowerCase()
    .replace(/latein/g, "latin")
    .replace(/standart/g, "standard")
    .replace(/hauptgruppe ii|hgr ii/g, "senior i")
    .replace(/hauptgruppe|hgr/g, "adult")
    .replace(/jugend/g, "youth")
    .replace(/junioren ii|junioren 2/g, "junior ii")
    .replace(/junioren|junior/g, "junior ii")
    .replace(/\bu\s?21\b/g, "under 21")
    .replace(/senioren/g, "senior")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── All-couples list (for the Compare tab) ────────────────────────────────────

function buildAllCouples(rows: CoupleRow[]): RankingEntry[] {
  return rows
    .map((r) => ({
      rank: r.place || 0,
      coupleName: r.coupleName,
      country: r.club,
      coupleNumber: r.number,
      points: "",
      athleteUrls: [] as string[],
    }))
    .sort((a, b) => (a.rank || 1e9) - (b.rank || 1e9));
}

// ─── Couple matching ───────────────────────────────────────────────────────────

/** A couple matches when every token of "first last" appears in one partner's name. */
function rowMatchesName(row: CoupleRow, firstName: string, lastName: string): boolean {
  const want = [...nameTokens(`${firstName} ${lastName}`)];
  if (!want.length) return false;
  return row.partners.some((p) => {
    const tok = nameTokens(p);
    return want.every((w) => tok.has(w));
  });
}

// ─── Public API ────────────────────────────────────────────────────────────────

interface ParsedTopTurnier {
  meta: TopTurnierMeta;
  rows: CoupleRow[];
  dances: string[];
  judges: Judge[];
  allCouples: RankingEntry[];
  competitionName: string;
}

async function parseTopTurnier(url: string): Promise<ParsedTopTurnier> {
  const urls = buildTopTurnierUrls(url);
  const [deckHtml, ergwertHtml] = await Promise.all([
    fetchHtml(urls.deck),
    fetchHtml(urls.ergwert),
  ]);
  if (!ergwertHtml) {
    throw new CoupleNotFoundError(
      "Could not read this competition. Make sure it's a TopTurnier results link (the page with deck.htm / ergwert.htm).",
    );
  }

  const $ = load(ergwertHtml);
  const { dances, judges } = parseErgwertHeader($);
  if (!dances.length || !judges.length) {
    throw new CoupleNotFoundError("This competition page has no readable scoring table.");
  }
  const rows = parseCoupleRows($, judges.length, dances.length);
  const meta = parseMeta(deckHtml, ergwertHtml);
  const allCouples = buildAllCouples(rows);
  return { meta, rows, dances, judges, allCouples, competitionName: meta.title };
}

/**
 * Build full `CompetitionAnalytics` for the couple whose one partner matches the
 * given account name. Throws `CoupleNotFoundError` when no couple matches.
 */
export async function topTurnierAnalytics(
  url: string,
  firstName: string,
  lastName: string,
): Promise<TopTurnierResult> {
  const parsed = await parseTopTurnier(url);
  const row = parsed.rows.find((r) => rowMatchesName(r, firstName, lastName));
  if (!row) {
    throw new CoupleNotFoundError(
      `No couple at this competition has a partner named "${firstName} ${lastName}". ` +
      `Check that your Dance Planner name matches how you're listed in the results.`,
    );
  }

  const { rounds, final } = buildCoupleAnalytics(row, parsed.dances, parsed.judges);
  const { danceStats, judgeStats, totalPossibleCrosses } = computeAnalyticsStats(rounds);
  const judgeNames: Record<string, string> = {};
  for (const j of parsed.judges) judgeNames[j.letter] = j.name;

  const analytics: CompetitionAnalytics = {
    competitionSlug: buildTopTurnierUrls(url).base,
    competitionName: parsed.competitionName,
    rankingUrl: url,
    coupleNumber: row.number,
    coupleName: row.coupleName,
    rounds,
    final,
    final3: null,
    scores3: null,
    danceStats,
    judgeStats,
    totalPossibleCrosses,
    reachedFinal: !!final && final.dances.some((d) => d.judgeEntries.length > 0),
    allCouples: parsed.allCouples,
    judgeNames,
  };

  return { meta: parsed.meta, analytics };
}

/** Round-by-round scores for ONE rival couple (Compare tab). System 3.0 = null. */
export async function topTurnierCoupleScores(
  url: string,
  coupleNumber: string,
): Promise<{ rounds: PrelimRound[]; final: FinalResult | null; scores3: null; final3: null }> {
  const parsed = await parseTopTurnier(url);
  const row = parsed.rows.find((r) => r.number === coupleNumber.trim());
  if (!row) return { rounds: [], final: null, scores3: null, final3: null };
  const { rounds, final } = buildCoupleAnalytics(row, parsed.dances, parsed.judges);
  return { rounds, final, scores3: null, final3: null };
}
