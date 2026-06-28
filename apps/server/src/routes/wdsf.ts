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
  ratingToElo,
  combinedTypeForCompetition,
  categoriesForProfile,
  filterProfileToCategory,
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
}

// Synthetic category key for couples whose competitions don't map to any combined
// WDSF ranking (Ten Dance / single dances only) — they still get one "Overall" board.
const OVERALL_KEY = "overall";

// Per-user couple-rating cache (all categories). Keyed by uuid|month.
const coupleRatingCache = new Map<string, { categories: CategoryRatingResult[]; at: number }>();

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
    for (const r of available) {
      const rt = r.rating;
      await prisma.wdsfCategoryRating.upsert({
        where: { userId_combinedType: { userId, combinedType: r.combinedType } },
        create: {
          userId, combinedType: r.combinedType, label: r.label,
          rating: rt.rating, tier: rt.tier, worldRank: rt.worldRank,
          regionalRank: rt.regionalRank, region: rt.region, deep: true,
        },
        update: {
          label: r.label, rating: rt.rating, tier: rt.tier, worldRank: rt.worldRank,
          regionalRank: rt.regionalRank, region: rt.region, deep: true, fetchedAt: new Date(),
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
        wdsfRatingAt: new Date(),
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
  const cats = categoriesForProfile(profile);
  if (!cats.length) {
    const rating = await computeCategoryRating(profile, uuid, OVERALL_KEY, snapshotCache);
    return [{ combinedType: OVERALL_KEY, label: "Overall", ageGroup: null, discipline: null, rating }];
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
    });
  }
  return out;
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
      res.json({ categories: cached.categories });
      return;
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
// cached (24h, keyed by `User.wdsfRatingAt`) so the board doesn't re-scrape everyone on
// each load; `?refresh=1` forces a full deep recompute (used when coefficients change).
const LEADERBOARD_TTL_MS = 24 * 60 * 60 * 1000; // 24h

router.get(
  "/leaderboard",
  asyncHandler(async (req, res) => {
    const force = req.query.refresh === "1" || req.query.refresh === "true";
    const requestedCategory = typeof req.query.category === "string" ? req.query.category : null;

    const users = await prisma.user.findMany({
      where: { wdsfProfileUrl: { not: null } },
      select: {
        id: true, firstName: true, lastName: true,
        wdsfProfileUrl: true, wdsfData: true, wdsfRatingAt: true,
      },
    });

    const snapshotCache = new Map<string, RankedCouple[]>();

    // Users that already have per-category snapshots — a fresh `wdsfRatingAt` alone
    // isn't enough (it may predate the per-category table), so a user with no category
    // rows is always recomputed.
    const haveCategoryRows = new Set(
      (await prisma.wdsfCategoryRating.findMany({
        where: { userId: { in: users.map((u) => u.id) } },
        select: { userId: true },
      })).map((r) => r.userId),
    );

    // 1) Ensure every user's per-category snapshots are fresh (compute the whole set
    //    in one pass per user; persisted to WdsfCategoryRating).
    for (const u of users) {
      if (!u.wdsfData || !u.wdsfProfileUrl) continue;
      const uuid = extractUuid(u.wdsfProfileUrl);
      if (!uuid) continue;

      const fresh =
        !force && haveCategoryRows.has(u.id) && u.wdsfRatingAt != null &&
        Date.now() - u.wdsfRatingAt.getTime() < LEADERBOARD_TTL_MS;
      if (fresh) continue;

      try {
        const profile = u.wdsfData as unknown as WdsfProfile;
        const results = await computeAllCategoryRatings(profile, uuid, snapshotCache);
        await persistCategoryRatings(u.id, results);
      } catch (err) {
        console.error("leaderboard: deep rating failed for", u.id, err);
      }
    }

    // 2) Read all per-category snapshots for these users.
    const userIds = users.map((u) => u.id);
    const nameById = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`.trim()]));
    const catRows = await prisma.wdsfCategoryRating.findMany({ where: { userId: { in: userIds } } });

    // 3) Available categories for the picker (sorted, with how many couples are in each).
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

    // 4) Resolve the target category: explicit request → viewer's primary → first available.
    let target = requestedCategory && catMap.has(requestedCategory) ? requestedCategory : null;
    if (!target) {
      const mine = new Set(catRows.filter((r) => r.userId === req.userId).map((r) => r.combinedType));
      target =
        availableCategories.find((c) => mine.has(c.combinedType))?.combinedType ??
        availableCategories[0]?.combinedType ?? null;
    }

    // 5) Build the board for the target category.
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
