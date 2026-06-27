import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { asyncHandler, HttpError } from "../lib/http";
import { prisma } from "../prisma";
import {
  findAthleteUrlByName,
  scrapeAthleteProfile,
  verifyAndScrape,
  scrapeCompetitionAnalytics,
  scrapeCoupleScores,
  scrapeRankingPage,
  buildCompUrls,
  extractUuid,
  type WdsfProfile,
} from "../lib/wdsfScraper";
import {
  combinedTypeFor,
  combinedTypeFromText,
  fetchWorldRanking,
  computeTournamentRating,
  RANKING_TOP_N,
  type RankedCouple,
  type TournamentRating,
} from "../lib/wdsfRanking";
import {
  computeCoupleRating,
  deriveWorldStanding,
  analyzeEvent,
  parseWdsfDate,
  type DeepEventSignal,
  type CoupleRating,
} from "../lib/wdsfCoupleRating";

const router = Router();
router.use(requireAuth);

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Tournament-rating helpers ─────────────────────────────────────────────────

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Parse a WDSF competition date string into { snapshotMonth: "YYYY-MM", dateISO }. */
function parseTournamentMonth(dateStr: string | undefined): { snapshotMonth: string; dateISO: string | null } {
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

// Per-competition result cache (stable once an event is past). Keyed by url|type|month.
const ratingResultCache = new Map<string, { rating: TournamentRating; at: number }>();

/** Get a top-N world-ranking snapshot, served from the DB cache when possible. */
async function getRankingSnapshot(
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

function unavailableRating(reason: string, combinedType: string, snapshotMonth: string | null): TournamentRating {
  return {
    available: false, reason, tier: "Unrated", rating: 0, participants: 0,
    n30: 0, n50: 0, n100: 0, n200: 0, bestRank: null, matched: [], combinedType, snapshotMonth,
  };
}

// GET /api/wdsf/profile — return cached WDSF data (auto-refresh if stale)
router.get(
  "/profile",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        wdsfMin: true,
        wdsfProfileUrl: true,
        wdsfData: true,
        wdsfUpdatedAt: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!user?.wdsfProfileUrl) {
      res.json({ profile: null });
      return;
    }

    const isStale = !user.wdsfUpdatedAt ||
      Date.now() - user.wdsfUpdatedAt.getTime() > CACHE_TTL_MS;

    if (isStale) {
      try {
        const fresh = await scrapeAthleteProfile(user.wdsfProfileUrl);
        await prisma.user.update({
          where: { id: req.userId },
          data: { wdsfData: fresh as object, wdsfUpdatedAt: new Date() },
        });
        res.json({ profile: fresh });
      } catch (err) {
        // Return cached data if refresh fails
        console.error("WDSF refresh failed, returning stale data:", err);
        res.json({ profile: user.wdsfData, stale: true });
      }
      return;
    }

    res.json({ profile: user.wdsfData });
  })
);

// POST /api/wdsf/link — link account by MIN (searches WDSF sitemaps by name)
router.post(
  "/link",
  asyncHandler(async (req, res) => {
    const { min } = z.object({ min: z.string().min(1).max(20) }).parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { firstName: true, lastName: true },
    });
    if (!user) throw new HttpError(404, "User not found");

    // Step 1: search sitemaps by user's name to find the profile URL
    const profileUrl = await findAthleteUrlByName(user.firstName, user.lastName);

    if (!profileUrl) {
      throw new HttpError(404,
        `Could not find a WDSF profile for "${user.firstName} ${user.lastName}". ` +
        `Make sure your name in Dance Planner matches your name on worlddancesport.org exactly.`
      );
    }

    // Step 2: fetch and verify the MIN matches
    let profile: WdsfProfile;
    try {
      profile = await verifyAndScrape(profileUrl, min);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      throw new HttpError(400, `WDSF profile found but verification failed: ${msg}`);
    }

    // Step 3: save to DB
    await prisma.user.update({
      where: { id: req.userId },
      data: {
        wdsfMin: min,
        wdsfProfileUrl: profileUrl,
        wdsfData: profile as object,
        wdsfUpdatedAt: new Date(),
      },
    });

    res.json({ profile });
  })
);

// POST /api/wdsf/link-url — link by providing the full WDSF profile URL directly
router.post(
  "/link-url",
  asyncHandler(async (req, res) => {
    const { url, min } = z.object({
      url: z.string().url(),
      min: z.string().min(1).max(20).optional(),
    }).parse(req.body);

    if (!extractUuid(url)) throw new HttpError(400, "URL does not contain a valid WDSF athlete UUID");

    const profile = await scrapeAthleteProfile(url);

    await prisma.user.update({
      where: { id: req.userId },
      data: {
        wdsfMin: min ?? profile.min ?? undefined,
        wdsfProfileUrl: url,
        wdsfData: profile as object,
        wdsfUpdatedAt: new Date(),
      },
    });

    res.json({ profile });
  })
);

// POST /api/wdsf/refresh — force re-fetch
router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { wdsfProfileUrl: true },
    });
    if (!user?.wdsfProfileUrl) throw new HttpError(400, "No WDSF profile linked");

    const profile = await scrapeAthleteProfile(user.wdsfProfileUrl);
    await prisma.user.update({
      where: { id: req.userId },
      data: { wdsfData: profile as object, wdsfUpdatedAt: new Date() },
    });

    res.json({ profile });
  })
);

// GET /api/wdsf/competition-analytics — fetch full analytics for one competition
// Query: competitionUrl (any /Competitions/ URL for the event)
router.get(
  "/competition-analytics",
  asyncHandler(async (req, res) => {
    const { competitionUrl } = z.object({
      competitionUrl: z.string().min(10),
    }).parse(req.query);

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { wdsfProfileUrl: true, wdsfData: true },
    });
    if (!user?.wdsfProfileUrl) throw new HttpError(400, "No WDSF profile linked");

    const uuid = extractUuid(user.wdsfProfileUrl);
    if (!uuid) throw new HttpError(400, "Could not extract UUID from profile URL");

    const analytics = await scrapeCompetitionAnalytics(competitionUrl, uuid);
    res.json({ analytics });
  })
);

// GET /api/wdsf/couple-scores — fetch one rival couple's System 3.0 breakdown
// Query: competitionUrl, coupleNumber — used by the Compare tab for side-by-side analysis
router.get(
  "/couple-scores",
  asyncHandler(async (req, res) => {
    const { competitionUrl, coupleNumber } = z.object({
      competitionUrl: z.string().min(10),
      coupleNumber: z.string().min(1).max(10),
    }).parse(req.query);

    const scores = await scrapeCoupleScores(competitionUrl, coupleNumber);
    res.json({ scores });
  })
);

// GET /api/wdsf/tournament-rating — grade the strength of a competition's field
// against the WDSF World Ranking (at the time of the event).
// Query: competitionUrl, category, discipline, date (the competition's date)
router.get(
  "/tournament-rating",
  asyncHandler(async (req, res) => {
    const { competitionUrl, category, discipline, date } = z.object({
      competitionUrl: z.string().min(10),
      category: z.string().min(1).max(60),
      discipline: z.string().min(1).max(60),
      date: z.string().max(40).optional(),
    }).parse(req.query);

    const { snapshotMonth, dateISO } = parseTournamentMonth(date);

    // Prefer the explicit category/discipline; fall back to scanning the competition
    // slug, which is reliable even when a profile's columns are mis-parsed.
    const combinedType =
      combinedTypeFor(category, discipline) ?? combinedTypeFromText(competitionUrl);
    if (!combinedType) {
      res.json({
        rating: unavailableRating(
          "No WDSF world ranking exists for this category/discipline.",
          "",
          snapshotMonth,
        ),
      });
      return;
    }

    const cacheKey = `${competitionUrl}|${combinedType}|${snapshotMonth}`;
    const cached = ratingResultCache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      res.json({ rating: cached.rating });
      return;
    }

    // Participants at the event + the world-ranking snapshot (parallel).
    const [{ entries }, ranking] = await Promise.all([
      scrapeRankingPage(buildCompUrls(competitionUrl).ranking),
      getRankingSnapshot(combinedType, snapshotMonth, dateISO),
    ]);

    const rating = computeTournamentRating(entries, ranking, combinedType, snapshotMonth);
    ratingResultCache.set(cacheKey, { rating, at: Date.now() });
    res.json({ rating });
  })
);

// ─── Couple-rating helpers ─────────────────────────────────────────────────────

// How many of the most recent mappable events get the full deep treatment
// (start list + World Ranking snapshot + round-by-round marks). Capped because
// each event costs several page fetches.
const DEEP_EVENTS = 6;

// Per-user couple-rating cache (whole computed result). Keyed by uuid|month.
const coupleRatingCache = new Map<string, { rating: CoupleRating; at: number }>();

/** Resolve the CombinedType for a competition (category/discipline → slug fallback). */
function combinedTypeForComp(c: { category: string; discipline: string; competitionUrl: string | null }): string | null {
  return (
    combinedTypeFor(c.category || "", c.discipline || "") ??
    (c.competitionUrl ? combinedTypeFromText(c.competitionUrl) : null)
  );
}

/**
 * Pick the world-ranking list that best represents the couple right now: the most
 * recent competition whose category/discipline maps to a combined ranking.
 */
function pickCombinedType(profile: WdsfProfile): string | null {
  const sorted = [...profile.competitions].sort(
    (a, b) => (parseWdsfDate(b.date)?.getTime() ?? 0) - (parseWdsfDate(a.date)?.getTime() ?? 0),
  );
  for (const c of sorted) {
    const ct = combinedTypeForComp(c);
    if (ct) return ct;
  }
  return null;
}

/** Deep-analyse one competition: start list + ranking snapshot + the pair's marks. */
async function analyzeCompetitionDeep(
  comp: WdsfProfile["competitions"][number],
  athleteUuid: string,
): Promise<DeepEventSignal | null> {
  const combinedType = combinedTypeForComp(comp);
  if (!combinedType || !comp.competitionUrl) return null;

  const { snapshotMonth, dateISO } = parseTournamentMonth(comp.date);
  const urls = buildCompUrls(comp.competitionUrl);

  const [{ entries }, ranking] = await Promise.all([
    scrapeRankingPage(urls.ranking),
    getRankingSnapshot(combinedType, snapshotMonth, dateISO),
  ]);

  // The pair's round-by-round marks (for round-1-exit detection) — needs the start
  // number from the result list. Best-effort; null if we can't resolve it.
  const myEntry = entries.find((e) =>
    e.athleteUrls.some((u) => extractUuid(u)?.toLowerCase() === athleteUuid.toLowerCase()),
  );
  let scores = null;
  if (myEntry?.coupleNumber) {
    try {
      scores = await scrapeCoupleScores(comp.competitionUrl, myEntry.coupleNumber);
    } catch (err) {
      console.error("couple-rating: couple-scores fetch failed:", err);
    }
  }

  return analyzeEvent({
    event: comp.event,
    date: comp.date,
    entries,
    ranking,
    combinedType,
    snapshotMonth,
    athleteUuid,
    scores,
  });
}

/** Persist a couple-rating snapshot on the user so the leaderboard can sort without re-scraping. */
async function persistRatingSnapshot(userId: string, rating: CoupleRating, deep: boolean): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        wdsfRating: rating.available ? rating.rating : null,
        wdsfRatingTier: rating.available ? rating.tier : null,
        wdsfWorldRank: rating.worldRank,
        wdsfRegion: rating.region,
        wdsfRatingDeep: deep,
        wdsfRatingAt: new Date(),
      },
    });
  } catch (err) {
    console.error("leaderboard: persist rating snapshot failed:", err);
  }
}

/**
 * Light couple rating for the leaderboard — profile-level stats + current world
 * standing only (NO deep per-event scraping). Cheap enough to run for every user;
 * the deep rating from the Rating tab supersedes it when present and fresh.
 * `snapshotCache` de-duplicates ranking-snapshot fetches across users in one request.
 */
async function computeLightRating(
  profile: WdsfProfile,
  uuid: string,
  snapshotCache: Map<string, RankedCouple[]>,
): Promise<CoupleRating> {
  let standing = null;
  const mainType = pickCombinedType(profile);
  if (mainType) {
    try {
      let ranking = snapshotCache.get(mainType);
      if (!ranking) {
        ranking = await getRankingSnapshot(mainType, currentMonthKey(), null);
        snapshotCache.set(mainType, ranking);
      }
      standing = deriveWorldStanding(ranking, uuid, profile.represents || null);
    } catch (err) {
      console.error("leaderboard: world standing lookup failed:", err);
    }
  }
  return computeCoupleRating(profile, { standing });
}

// GET /api/wdsf/couple-rating — overall 1–10 couple rating (TEST) + world/regional rank
router.get(
  "/couple-rating",
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { wdsfProfileUrl: true, wdsfData: true },
    });
    if (!user?.wdsfProfileUrl || !user.wdsfData) {
      throw new HttpError(400, "No WDSF profile linked");
    }

    const profile = user.wdsfData as unknown as WdsfProfile;
    const uuid = extractUuid(user.wdsfProfileUrl);
    if (!uuid) throw new HttpError(400, "Could not extract UUID from profile URL");

    const cacheKey = `${uuid}|${currentMonthKey()}`;
    const cached = coupleRatingCache.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      res.json({ rating: cached.rating });
      return;
    }

    // 1) Current world + regional standing (one snapshot for the couple's main list).
    let standing = null;
    const mainType = pickCombinedType(profile);
    if (mainType) {
      try {
        const ranking = await getRankingSnapshot(mainType, currentMonthKey(), null);
        standing = deriveWorldStanding(ranking, uuid, profile.represents || null);
      } catch (err) {
        console.error("couple-rating: world standing lookup failed:", err);
      }
    }

    // 2) Deep per-event signals for the most recent mappable events (real tier,
    //    upset wins vs higher-ranked couples, bad losses, round-1 exits).
    const recentMappable = [...profile.competitions]
      .filter((c) => c.competitionUrl && combinedTypeForComp(c))
      .sort((a, b) => (parseWdsfDate(b.date)?.getTime() ?? 0) - (parseWdsfDate(a.date)?.getTime() ?? 0))
      .slice(0, DEEP_EVENTS);

    const settled = await Promise.allSettled(
      recentMappable.map((c) => analyzeCompetitionDeep(c, uuid)),
    );
    const deep: DeepEventSignal[] = [];
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value) deep.push(r.value);
      else if (r.status === "rejected") console.error("couple-rating: deep event failed:", r.reason);
    }

    const rating = computeCoupleRating(profile, { standing, deep });
    coupleRatingCache.set(cacheKey, { rating, at: Date.now() });
    await persistRatingSnapshot(req.userId!, rating, true);
    res.json({ rating });
  })
);

// GET /api/wdsf/leaderboard — global ranking of all WDSF-linked registered users by
// their overall couple rating (highest first). Users without a fresh snapshot get a
// cheap light rating computed on the spot; the Rating tab upgrades it to deep later.
const LEADERBOARD_TTL_MS = 24 * 60 * 60 * 1000; // 24h

router.get(
  "/leaderboard",
  asyncHandler(async (req, res) => {
    const users = await prisma.user.findMany({
      where: { wdsfProfileUrl: { not: null } },
      select: {
        id: true, firstName: true, lastName: true,
        wdsfProfileUrl: true, wdsfData: true,
        wdsfRating: true, wdsfRatingTier: true, wdsfWorldRank: true,
        wdsfRegion: true, wdsfRatingDeep: true, wdsfRatingAt: true,
      },
    });

    const snapshotCache = new Map<string, RankedCouple[]>();

    interface Row {
      userId: string; name: string; rating: number; tier: string;
      region: string | null; worldRank: number | null; deep: boolean; isMe: boolean;
    }
    const rows: Row[] = [];

    for (const u of users) {
      if (!u.wdsfData || !u.wdsfProfileUrl) continue;
      const uuid = extractUuid(u.wdsfProfileUrl);
      if (!uuid) continue;

      let rating = u.wdsfRating;
      let tier = u.wdsfRatingTier;
      let worldRank = u.wdsfWorldRank;
      let region = u.wdsfRegion;
      let deep = u.wdsfRatingDeep;

      const fresh =
        rating != null && u.wdsfRatingAt != null &&
        Date.now() - u.wdsfRatingAt.getTime() < LEADERBOARD_TTL_MS;

      if (!fresh) {
        try {
          const profile = u.wdsfData as unknown as WdsfProfile;
          const computed = await computeLightRating(profile, uuid, snapshotCache);
          await persistRatingSnapshot(u.id, computed, false);
          rating = computed.available ? computed.rating : null;
          tier = computed.available ? computed.tier : null;
          worldRank = computed.worldRank;
          region = computed.region;
          deep = false;
        } catch (err) {
          console.error("leaderboard: light rating failed for", u.id, err);
        }
      }

      if (rating == null) continue;
      rows.push({
        userId: u.id,
        name: `${u.firstName} ${u.lastName}`.trim(),
        rating,
        tier: tier ?? "Unrated",
        region: region ?? null,
        worldRank: worldRank ?? null,
        deep,
        isMe: u.id === req.userId,
      });
    }

    rows.sort((a, b) =>
      b.rating - a.rating ||
      (a.worldRank ?? 1e9) - (b.worldRank ?? 1e9) ||
      a.name.localeCompare(b.name),
    );

    const leaderboard = rows.map((r, i) => ({ position: i + 1, ...r }));
    res.json({ leaderboard, generatedAt: new Date().toISOString() });
  })
);

// DELETE /api/wdsf/unlink — remove WDSF connection
router.delete(
  "/unlink",
  asyncHandler(async (req, res) => {
    await prisma.user.update({
      where: { id: req.userId },
      data: {
        wdsfMin: null,
        wdsfProfileUrl: null,
        wdsfData: { set: null } as never,
        wdsfUpdatedAt: null,
      },
    });
    res.status(204).end();
  })
);

export default router;
