import { prisma } from "../prisma";
import { fetchWorldRanking, RANKING_TOP_N, type RankedCouple } from "./wdsfRanking";

// ─── Shared WDSF World-Ranking snapshot cache ──────────────────────────────────
// Extracted from routes/wdsf.ts so both the WDSF analytics routes and the manual
// (TopTurnier) analysis route can grade a competition's field against the World
// Ranking that was current at the time of the event.

export const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Parse a competition date string into { snapshotMonth: "YYYY-MM", dateISO }. */
export function parseTournamentMonth(dateStr: string | undefined | null): {
  snapshotMonth: string; dateISO: string | null;
} {
  const fallback = { snapshotMonth: currentMonthKey(), dateISO: null };
  if (!dateStr) return fallback;

  let y: number | null = null;
  let m: number | null = null; // 1-based

  const iso = dateStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  const named = dateStr.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  const dmy = dateStr.match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);

  if (iso) { y = +iso[1]; m = +iso[2]; }
  else if (named) { const mi = MONTHS.indexOf(named[2].toLowerCase()); if (mi >= 0) { y = +named[3]; m = mi + 1; } }
  else if (dmy) { y = +dmy[3]; m = +dmy[2]; }
  else { const t = Date.parse(dateStr); if (!isNaN(t)) { const d = new Date(t); y = d.getUTCFullYear(); m = d.getUTCMonth() + 1; } }

  if (!y || !m || m < 1 || m > 12) return fallback;
  const mm = String(m).padStart(2, "0");
  return { snapshotMonth: `${y}-${mm}`, dateISO: `${y}-${mm}-01` };
}

/** Get a top-N world-ranking snapshot, served from the DB cache when possible. */
export async function getRankingSnapshot(
  combinedType: string,
  snapshotMonth: string,
  dateISO: string | null,
): Promise<RankedCouple[]> {
  const isCurrentMonth = snapshotMonth === currentMonthKey();
  const existing = await prisma.wdsfRankingSnapshot.findUnique({
    where: { combinedType_snapshotMonth: { combinedType, snapshotMonth } },
  });
  if (existing) {
    const fresh = !isCurrentMonth || Date.now() - existing.fetchedAt.getTime() < CACHE_TTL_MS;
    if (fresh) return existing.data as unknown as RankedCouple[];
  }

  // Past months are immutable → fetch the historical snapshot; current month → latest.
  const ranking = await fetchWorldRanking(combinedType, RANKING_TOP_N, isCurrentMonth ? null : dateISO);
  await prisma.wdsfRankingSnapshot.upsert({
    where: { combinedType_snapshotMonth: { combinedType, snapshotMonth } },
    create: { combinedType, snapshotMonth, data: ranking as object },
    update: { data: ranking as object, fetchedAt: new Date() },
  });
  return ranking;
}
