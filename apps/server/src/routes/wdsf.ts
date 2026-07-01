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
  nameMatchesProfile,
  type WdsfProfile,
} from "../lib/wdsfScraper";
import {
  combinedTypeFor,
  combinedTypeFromText,
  describeCombinedType,
  categorySortKey,
  computeTournamentRating,
  type RankedCouple,
  type TournamentRating,
} from "../lib/wdsfRanking";
import {
  computeCoupleRating,
  deriveWorldStanding,
  analyzeEvent,
  parseWdsfDate,
  ratingToElo,
  combinedTypeForCompetition,
  categoriesForProfile,
  filterProfileToCategory,
  isCategoryInactive,
  type DeepEventSignal,
  type CoupleRating,
} from "../lib/wdsfCoupleRating";
import {
  CACHE_TTL_MS,
  currentMonthKey,
  parseTournamentMonth,
  getRankingSnapshot,
} from "../lib/rankingSnapshot";

const router = Router();
router.use(requireAuth);

// ─── Tournament-rating helpers ─────────────────────────────────────────────────

// Per-competition result cache (stable once an event is past). Keyed by url|type|month.
const ratingResultCache = new Map<string, { rating: TournamentRating; at: number }>();

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

    // Step 2b: the linked profile's name must match this account's name, so a user
    // can't connect someone else's WDSF profile.
    if (!nameMatchesProfile(user.firstName, user.lastName, profile)) {
      throw new HttpError(403,
        `This WDSF profile (${profile.name}) does not match your account name ` +
        `(${user.firstName} ${user.lastName}). Update your name in Dance Planner to ` +
        `exactly match your WDSF/DTV card, then try again.`
      );
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

    const account = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { firstName: true, lastName: true },
    });
    if (!account) throw new HttpError(404, "User not found");

    const profile = await scrapeAthleteProfile(url);

    // The linked profile's name must match this account's name, so a user can't
    // connect someone else's WDSF profile.
    if (!nameMatchesProfile(account.firstName, account.lastName, profile)) {
      throw new HttpError(403,
        `This WDSF profile (${profile.name}) does not match your account name ` +
        `(${account.firstName} ${account.lastName}). Update your name in Dance Planner to ` +
        `exactly match your WDSF/DTV card, then try again.`
      );
    }

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

// One category's rating result (returned by the couple-rating endpoint).
interface CategoryRatingResult {
  combinedType: string;
  label: string;
  ageGroup: string | null;
  discipline: string | null;
  rating: CoupleRating;
  inactive: boolean;          // not danced in > 1 year → hidden from leaderboard
  lastDanced: string | null;  // ISO date of the most recent competition in this category
}

// Synthetic category key for couples whose competitions don't map to any combined
// WDSF ranking (Ten Dance / single dances only) — they still get one "Overall" board.
const OVERALL_KEY = "overall";

// Per-user couple-rating cache (all categories). Keyed by uuid|month.
const coupleRatingCache = new Map<string, { categories: CategoryRatingResult[]; at: number }>();

// Couple rating / leaderboard snapshots are expensive: they scrape recent WDSF
// events and score pages. Keep DB snapshots for a week and refresh stale rows in
// the background so opening the board is a quick read most of the time.
const RATING_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const ratingRefreshJobs = new Set<string>();

interface CategoryRatingRow {
  userId: string;
  combinedType: string;
  label: string;
  rating: number;
  tier: string;
  worldRank: number | null;
  regionalRank: number | null;
  region: string | null;
  deep: boolean;
  details?: unknown | null;
  lastDanced: Date | null;
  inactive: boolean;
  fetchedAt: Date;
}

interface RatingRefreshUser {
  id: string;
  wdsfProfileUrl: string | null;
  wdsfData: unknown | null;
  wdsfUpdatedAt?: Date | null;
}

function isFreshRatingSnapshot(fetchedAt: Date | null | undefined, updatedAt?: Date | null): boolean {
  if (!fetchedAt) return false;
  if (Date.now() - fetchedAt.getTime() >= RATING_CACHE_TTL_MS) return false;
  return !updatedAt || fetchedAt.getTime() >= updatedAt.getTime();
}

function emptyRatingStats(): CoupleRating["stats"] {
  return {
    competitionsConsidered: 0,
    avgPlace: null,
    finals: 0,
    podiums: 0,
    firstPlaces: 0,
    monthsSinceLast: null,
    recentAvgPlace: null,
    olderAvgPlace: null,
    deepEventsAnalyzed: 0,
    upsetWins: 0,
    badLosses: 0,
    roundOneExits: 0,
  };
}

function summaryRatingFromRow(row: CategoryRatingRow): CoupleRating {
  return {
    available: true,
    rating: row.rating,
    elo: ratingToElo(row.rating),
    tier: row.tier as CoupleRating["tier"],
    baseRating: row.rating,
    worldRank: row.worldRank,
    regionalRank: row.regionalRank,
    region: row.region,
    components: [],
    penalties: [],
    bonuses: [],
    stats: emptyRatingStats(),
    events: [],
  };
}

function ratingFromRow(row: CategoryRatingRow): CoupleRating {
  const summary = summaryRatingFromRow(row);
  if (!row.details || typeof row.details !== "object") return summary;

  const raw = row.details as Partial<CoupleRating>;
  return {
    ...summary,
    ...raw,
    available: raw.available ?? summary.available,
    rating: typeof raw.rating === "number" ? raw.rating : summary.rating,
    elo: typeof raw.elo === "number" ? raw.elo : summary.elo,
    tier: (typeof raw.tier === "string" ? raw.tier : summary.tier) as CoupleRating["tier"],
    baseRating: typeof raw.baseRating === "number" ? raw.baseRating : summary.baseRating,
    worldRank: raw.worldRank ?? summary.worldRank,
    regionalRank: raw.regionalRank ?? summary.regionalRank,
    region: raw.region ?? summary.region,
    components: Array.isArray(raw.components) ? raw.components : [],
    penalties: Array.isArray(raw.penalties) ? raw.penalties : [],
    bonuses: Array.isArray(raw.bonuses) ? raw.bonuses : [],
    stats: { ...emptyRatingStats(), ...(raw.stats && typeof raw.stats === "object" ? raw.stats : {}) },
    events: Array.isArray(raw.events) ? raw.events : [],
  };
}

function categoryResultsFromRows(rows: CategoryRatingRow[]): CategoryRatingResult[] {
  return rows
    .map((row) => {
      const info = describeCombinedType(row.combinedType);
      return {
        combinedType: row.combinedType,
        label: row.label,
        ageGroup: info?.ageLabel ?? null,
        discipline: info?.discLabel ?? null,
        rating: ratingFromRow(row),
        inactive: row.inactive,
        lastDanced: row.lastDanced ? row.lastDanced.toISOString() : null,
      };
    })
    .sort((a, b) => {
      const byDate = (b.lastDanced ? Date.parse(b.lastDanced) : 0) -
        (a.lastDanced ? Date.parse(a.lastDanced) : 0);
      return byDate || categorySortKey(a.combinedType) - categorySortKey(b.combinedType);
    });
}

async function readCachedCategoryRatings(
  userId: string,
  opts: { freshOnly: boolean; profileUpdatedAt?: Date | null; requireDetails?: boolean },
): Promise<CategoryRatingResult[] | null> {
  const rows = await prisma.wdsfCategoryRating.findMany({
    where: { userId },
  }) as CategoryRatingRow[];
  if (!rows.length) return null;
  if (opts.freshOnly) {
    const fresh = rows.every((row) => isFreshRatingSnapshot(row.fetchedAt, opts.profileUpdatedAt));
    const hasDetails = !opts.requireDetails || rows.every((row) => row.details && typeof row.details === "object");
    if (!fresh || !hasDetails) return null;
  }
  return categoryResultsFromRows(rows);
}

/** Deep-analyse one competition: start list + ranking snapshot + the pair's marks. */
async function analyzeCompetitionDeep(
  comp: WdsfProfile["competitions"][number],
  athleteUuid: string,
): Promise<DeepEventSignal | null> {
  const combinedType = combinedTypeForCompetition(comp);
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

/**
 * Persist a couple's per-category rating snapshots so the leaderboard can sort within
 * a category without re-scraping. Upserts one row per available category, drops
 * categories the couple no longer competes in, and mirrors the PRIMARY (most-recent)
 * category onto the User.wdsfRating* columns (+ stamps `wdsfRatingAt` as the freshness
 * marker for the whole set).
 */
async function persistCategoryRatings(userId: string, results: CategoryRatingResult[]): Promise<void> {
  try {
    const available = results.filter((r) => r.rating.available);
    const fetchedAt = new Date();
    for (const r of available) {
      const rt = r.rating;
      const lastDanced = r.lastDanced ? new Date(r.lastDanced) : null;
      await prisma.wdsfCategoryRating.upsert({
        where: { userId_combinedType: { userId, combinedType: r.combinedType } },
        create: {
          userId, combinedType: r.combinedType, label: r.label,
          rating: rt.rating, tier: rt.tier, worldRank: rt.worldRank,
          regionalRank: rt.regionalRank, region: rt.region, deep: true,
          details: rt as object, lastDanced, inactive: r.inactive, fetchedAt,
        },
        update: {
          label: r.label, rating: rt.rating, tier: rt.tier, worldRank: rt.worldRank,
          regionalRank: rt.regionalRank, region: rt.region, deep: true,
          details: rt as object, fetchedAt,
          lastDanced, inactive: r.inactive,
        },
      });
    }
    const keep = available.map((r) => r.combinedType);
    await prisma.wdsfCategoryRating.deleteMany({
      where: { userId, combinedType: { notIn: keep.length ? keep : ["__none__"] } },
    });

    const primary = available[0] ?? null;
    await prisma.user.update({
      where: { id: userId },
      data: {
        wdsfRating: primary?.rating.rating ?? null,
        wdsfRatingTier: primary?.rating.tier ?? null,
        wdsfWorldRank: primary?.rating.worldRank ?? null,
        wdsfRegion: primary?.rating.region ?? null,
        wdsfRatingDeep: true,
        wdsfRatingAt: fetchedAt,
      },
    });
  } catch (err) {
    console.error("leaderboard: persist category ratings failed:", err);
  }
}

/**
 * DEEP rating for ONE category — world standing from THAT category's ranking + deep
 * per-event analysis of that category's recent events. Computing the standing against
 * the correct category's list is what fixes couples wrongly shown as "not in ranking"
 * (their world rank lives in a different category than their latest competition).
 */
async function computeCategoryRating(
  profile: WdsfProfile,
  uuid: string,
  combinedType: string,
  snapshotCache: Map<string, RankedCouple[]>,
): Promise<CoupleRating> {
  const catProfile =
    combinedType === OVERALL_KEY ? profile : filterProfileToCategory(profile, combinedType);

  // 1) Current world + regional standing, from THIS category's ranking list.
  let standing = null;
  if (combinedType !== OVERALL_KEY) {
    try {
      let ranking = snapshotCache.get(combinedType);
      if (!ranking) {
        ranking = await getRankingSnapshot(combinedType, currentMonthKey(), null);
        snapshotCache.set(combinedType, ranking);
      }
      standing = deriveWorldStanding(ranking, uuid, profile.represents || null);
    } catch (err) {
      console.error("rating: world standing lookup failed:", err);
    }
  }

  // 2) Deep per-event signals for this category's most recent mappable events.
  const recentMappable = [...catProfile.competitions]
    .filter((c) => c.competitionUrl && combinedTypeForCompetition(c) === combinedType)
    .sort((a, b) => (parseWdsfDate(b.date)?.getTime() ?? 0) - (parseWdsfDate(a.date)?.getTime() ?? 0))
    .slice(0, DEEP_EVENTS);

  const settled = await Promise.allSettled(
    recentMappable.map((c) => analyzeCompetitionDeep(c, uuid)),
  );
  const deep: DeepEventSignal[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled" && r.value) deep.push(r.value);
    else if (r.status === "rejected") console.error("rating: deep event failed:", r.reason);
  }

  return computeCoupleRating(catProfile, { standing, deep });
}

/**
 * All category ratings for a couple (Adult Latin, Adult Standard, Rising Stars …),
 * ordered primary (most-recently-danced) first. Couples whose history maps to no
 * combined ranking get a single synthetic "Overall" category.
 * `snapshotCache` de-duplicates ranking-snapshot fetches across users in one request.
 */
async function computeAllCategoryRatings(
  profile: WdsfProfile,
  uuid: string,
  snapshotCache: Map<string, RankedCouple[]>,
): Promise<CategoryRatingResult[]> {
  const now = new Date();
  const cats = categoriesForProfile(profile);
  if (!cats.length) {
    const rating = await computeCategoryRating(profile, uuid, OVERALL_KEY, snapshotCache);
    // Most-recent competition across the whole profile = the "Overall" category's freshness.
    const lastMs = profile.competitions.reduce(
      (mx, c) => Math.max(mx, parseWdsfDate(c.date)?.getTime() ?? 0), 0,
    );
    return [{
      combinedType: OVERALL_KEY, label: "Overall", ageGroup: null, discipline: null, rating,
      inactive: isCategoryInactive(lastMs, now),
      lastDanced: lastMs ? new Date(lastMs).toISOString() : null,
    }];
  }
  const out: CategoryRatingResult[] = [];
  for (const cat of cats) {
    const rating = await computeCategoryRating(profile, uuid, cat.combinedType, snapshotCache);
    out.push({
      combinedType: cat.combinedType,
      label: cat.label,
      ageGroup: cat.ageLabel,
      discipline: cat.discLabel,
      rating,
      inactive: isCategoryInactive(cat.lastDanced, now),
      lastDanced: cat.lastDanced ? new Date(cat.lastDanced).toISOString() : null,
    });
  }
  return out;
}

async function refreshUserCategoryRatings(
  user: RatingRefreshUser,
  snapshotCache: Map<string, RankedCouple[]>,
): Promise<void> {
  if (!user.wdsfData || !user.wdsfProfileUrl) return;
  const uuid = extractUuid(user.wdsfProfileUrl);
  if (!uuid) return;

  const profile = user.wdsfData as unknown as WdsfProfile;
  const categories = await computeAllCategoryRatings(profile, uuid, snapshotCache);
  coupleRatingCache.set(`${uuid}|${currentMonthKey()}`, { categories, at: Date.now() });
  await persistCategoryRatings(user.id, categories);
}

function queueRatingRefresh(users: RatingRefreshUser[], reason: string): boolean {
  const queued = users.filter((user) => {
    if (ratingRefreshJobs.has(user.id)) return false;
    ratingRefreshJobs.add(user.id);
    return true;
  });
  if (!queued.length) return false;

  void (async () => {
    const snapshotCache = new Map<string, RankedCouple[]>();
    for (const user of queued) {
      try {
        await refreshUserCategoryRatings(user, snapshotCache);
      } catch (err) {
        console.error(`rating background refresh failed (${reason}) for`, user.id, err);
      } finally {
        ratingRefreshJobs.delete(user.id);
      }
    }
  })();
  return true;
}

// GET /api/wdsf/couple-rating — overall 1–10 couple rating (TEST) + world/regional rank
router.get(
  "/couple-rating",
  asyncHandler(async (req, res) => {
    const force = req.query.refresh === "1" || req.query.refresh === "true";
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, wdsfProfileUrl: true, wdsfData: true, wdsfUpdatedAt: true },
    });
    if (!user?.wdsfProfileUrl || !user.wdsfData) {
      throw new HttpError(400, "No WDSF profile linked");
    }

    const profile = user.wdsfData as unknown as WdsfProfile;
    const uuid = extractUuid(user.wdsfProfileUrl);
    if (!uuid) throw new HttpError(400, "Could not extract UUID from profile URL");

    const cacheKey = `${uuid}|${currentMonthKey()}`;
    const cached = coupleRatingCache.get(cacheKey);
    const memoryFresh = cached &&
      Date.now() - cached.at < RATING_CACHE_TTL_MS &&
      (!user.wdsfUpdatedAt || cached.at >= user.wdsfUpdatedAt.getTime());
    if (!force && memoryFresh) {
      res.json({ categories: cached.categories });
      return;
    }

    if (!force) {
      const dbFresh = await readCachedCategoryRatings(user.id, {
        freshOnly: true,
        profileUpdatedAt: user.wdsfUpdatedAt,
        requireDetails: true,
      });
      if (dbFresh) {
        coupleRatingCache.set(cacheKey, { categories: dbFresh, at: Date.now() });
        res.json({ categories: dbFresh, cached: true });
        return;
      }

      const dbStale = await readCachedCategoryRatings(user.id, { freshOnly: false });
      if (dbStale) {
        queueRatingRefresh([user], "couple-rating stale cache");
        res.json({ categories: dbStale, cached: true, refreshing: true });
        return;
      }
    }

    const categories = await computeAllCategoryRatings(profile, uuid, new Map());
    coupleRatingCache.set(cacheKey, { categories, at: Date.now() });
    await persistCategoryRatings(req.userId!, categories);
    res.json({ categories });
  })
);

// GET /api/wdsf/leaderboard — per-category ranking of all WDSF-linked registered
// users. A couple can dance several categories (Adult Latin, Adult Standard, Rising
// Stars …), each with its own World Ranking, so the board ranks WITHIN one category.
// Query `?category=<combinedType>` selects the board (defaults to the viewer's primary
// category, else the first available). It's a real mini-competition: every dancer is
// scored with the same DEEP rating the Rating tab uses. Per-category snapshots are
// cached for a week. Stale/missing users are refreshed in the background so the board
// doesn't re-scrape everyone before responding; `?refresh=1` queues a full refresh.
const LEADERBOARD_TTL_MS = RATING_CACHE_TTL_MS;

router.get(
  "/leaderboard",
  asyncHandler(async (req, res) => {
    const force = req.query.refresh === "1" || req.query.refresh === "true";
    const requestedCategory = typeof req.query.category === "string" ? req.query.category : null;

    const users = await prisma.user.findMany({
      where: { wdsfProfileUrl: { not: null } },
      select: {
        id: true, firstName: true, lastName: true,
        wdsfProfileUrl: true, wdsfData: true, wdsfUpdatedAt: true,
      },
    });

    // 1) Read cached per-category snapshots. This is the hot path: fast DB read,
    //    no WDSF scraping before the response is sent.
    const userIds = users.map((u) => u.id);
    const nameById = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
    const allCategoryRows = await prisma.wdsfCategoryRating.findMany({
      where: { userId: { in: userIds } },
    }) as CategoryRatingRow[];

    const rowsByUser = new Map<string, CategoryRatingRow[]>();
    for (const row of allCategoryRows) {
      const list = rowsByUser.get(row.userId);
      if (list) list.push(row);
      else rowsByUser.set(row.userId, [row]);
    }

    const staleUsers = users.filter((u) => {
      if (!u.wdsfData || !u.wdsfProfileUrl || !extractUuid(u.wdsfProfileUrl)) return false;
      const rows = rowsByUser.get(u.id) ?? [];
      if (force) return true;
      return !rows.length || !rows.every((row) => {
        if (!row.fetchedAt) return false;
        if (Date.now() - row.fetchedAt.getTime() >= LEADERBOARD_TTL_MS) return false;
        return !u.wdsfUpdatedAt || row.fetchedAt.getTime() >= u.wdsfUpdatedAt.getTime();
      });
    });
    const refreshing = queueRatingRefresh(staleUsers, force ? "leaderboard forced" : "leaderboard stale cache");

    // Inactive categories (not danced for > 1 year) are excluded from every board.
    const catRows = allCategoryRows.filter((row) => !row.inactive);

    // 2) Available categories for the picker (sorted, with how many couples are in each).
    const catMap = new Map<string, { combinedType: string; label: string; ageGroup: string | null; discipline: string | null; count: number }>();
    for (const r of catRows) {
      const ex = catMap.get(r.combinedType);
      if (ex) { ex.count++; continue; }
      const info = describeCombinedType(r.combinedType);
      catMap.set(r.combinedType, {
        combinedType: r.combinedType, label: r.label,
        ageGroup: info?.ageLabel ?? null, discipline: info?.discLabel ?? null, count: 1,
      });
    }
    const availableCategories = [...catMap.values()].sort(
      (a, b) => categorySortKey(a.combinedType) - categorySortKey(b.combinedType) || b.count - a.count,
    );

    // 3) Resolve the target category: explicit request → viewer's primary → first available.
    let target = requestedCategory && catMap.has(requestedCategory) ? requestedCategory : null;
    if (!target) {
      const mine = new Set(catRows.filter((r) => r.userId === req.userId).map((r) => r.combinedType));
      target =
        availableCategories.find((c) => mine.has(c.combinedType))?.combinedType ??
        availableCategories[0]?.combinedType ?? null;
    }

    // 4) Build the board for the target category.
    const rows = catRows
      .filter((r) => r.combinedType === target)
      .map((r) => ({
        userId: r.userId,
        name: nameById.get(r.userId) ?? "",
        rating: r.rating,
        elo: ratingToElo(r.rating),
        tier: r.tier,
        region: r.region,
        worldRank: r.worldRank,
        deep: r.deep,
        isMe: r.userId === req.userId,
      }))
      .sort((a, b) =>
        b.elo - a.elo ||
        (a.worldRank ?? 1e9) - (b.worldRank ?? 1e9) ||
        a.name.localeCompare(b.name),
      );

    const leaderboard = rows.map((r, i) => ({ position: i + 1, ...r }));
    res.json({
      category: target,
      categoryLabel: target
        ? describeCombinedType(target)?.label ?? catMap.get(target)?.label ?? "Overall"
        : null,
      availableCategories: availableCategories.map(({ count: _count, ...c }) => c),
      leaderboard,
      generatedAt: new Date().toISOString(),
      refreshing,
    });
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
