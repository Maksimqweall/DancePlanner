import { config } from "dotenv";
import { join } from "path";
config({ path: join(__dirname, ".env") });
import { prisma } from "./src/prisma";
import { scrapeAthleteProfile, scrapeRankingPage, buildCompUrls } from "./src/lib/wdsfScraper";
import { combinedTypeFor, fetchWorldRanking, computeTournamentRating, RANKING_TOP_N, type RankedCouple } from "./src/lib/wdsfRanking";

// Mirror of the route's getRankingSnapshot (DB-cached) to exercise the Prisma model.
async function getRankingSnapshot(combinedType: string, snapshotMonth: string, dateISO: string | null): Promise<RankedCouple[]> {
  const existing = await prisma.wdsfRankingSnapshot.findUnique({
    where: { combinedType_snapshotMonth: { combinedType, snapshotMonth } },
  });
  if (existing) { console.log("  [cache HIT]"); return existing.data as unknown as RankedCouple[]; }
  console.log("  [cache MISS → fetching live]");
  const ranking = await fetchWorldRanking(combinedType, RANKING_TOP_N, dateISO);
  await prisma.wdsfRankingSnapshot.upsert({
    where: { combinedType_snapshotMonth: { combinedType, snapshotMonth } },
    create: { combinedType, snapshotMonth, data: ranking as object },
    update: { data: ranking as object, fetchedAt: new Date() },
  });
  return ranking;
}

async function main() {
  // World #1 Adult Standard couple's man → use his profile to find a real competition.
  const uuid = "1250660e-2f22-4508-bc6d-9e1401280706"; // Dariusz Mycka
  const profile = await scrapeAthleteProfile(`https://www.worlddancesport.org/Athletes/x-${uuid}`);
  const comp = profile.competitions.find(c => c.competitionUrl && c.discipline && c.category);
  if (!comp) { console.log("No suitable competition found on profile"); return; }
  console.log(`Competition: ${comp.event} | ${comp.date} | ${comp.discipline} | ${comp.category}`);
  console.log(`URL: ${comp.competitionUrl}`);

  const combinedType = combinedTypeFor(comp.category, comp.discipline);
  console.log(`combinedType: ${combinedType}`);
  if (!combinedType) { console.log("→ unavailable (unsupported category)"); return; }

  const snapshotMonth = (comp.date.match(/(\d{4})/)?.[1] ?? "2026") + "-01"; // crude for the smoke test
  const [{ entries }, ranking] = await Promise.all([
    scrapeRankingPage(buildCompUrls(comp.competitionUrl!).ranking),
    getRankingSnapshot(combinedType, snapshotMonth, `${snapshotMonth}-01`),
  ]);
  console.log(`participants scraped: ${entries.length} | ranking size: ${ranking.length}`);

  const rating = computeTournamentRating(entries, ranking, combinedType, snapshotMonth);
  console.log("RATING:", JSON.stringify({
    tier: rating.tier, rating: rating.rating, available: rating.available,
    n30: rating.n30, n50: rating.n50, n100: rating.n100, n200: rating.n200,
    bestRank: rating.bestRank, matched: rating.matched.length,
  }));
  console.log("top matched:", rating.matched.slice(0, 5).map(m => `#${m.worldRank} ${m.coupleName}`));

  const row = await prisma.wdsfRankingSnapshot.findUnique({ where: { combinedType_snapshotMonth: { combinedType, snapshotMonth } } });
  console.log(`DB snapshot row present: ${!!row}, fetchedAt: ${row?.fetchedAt.toISOString()}`);
}

main().then(async () => { await prisma.$disconnect(); process.exit(0); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
