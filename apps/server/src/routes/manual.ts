import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { asyncHandler, HttpError } from "../lib/http";
import { prisma } from "../prisma";
import {
  topTurnierAnalytics,
  topTurnierCoupleScores,
  normalizeTitleForRanking,
  CoupleNotFoundError,
} from "../lib/topTurnierScraper";
import {
  combinedTypeFor,
  combinedTypeFromText,
  computeTournamentRatingByName,
  type TournamentRating,
} from "../lib/wdsfRanking";
import type { TopTurnierMeta } from "../lib/topTurnierScraper";
import type { RankingEntry } from "../lib/wdsfScraper";
import { getRankingSnapshot, parseTournamentMonth } from "../lib/rankingSnapshot";

const router = Router();
router.use(requireAuth);

/** Grade the field strength of a parsed TopTurnier event by name-matching the WDSF ranking. */
async function fieldRating(
  meta: TopTurnierMeta,
  allCouples: RankingEntry[],
): Promise<TournamentRating | null> {
  const text = normalizeTitleForRanking(meta.title);
  const combinedType =
    (meta.category && meta.discipline ? combinedTypeFor(meta.category, meta.discipline) : null) ??
    combinedTypeFromText(text);
  if (!combinedType) return null; // no WDSF world ranking for this category/discipline

  try {
    const { snapshotMonth, dateISO } = parseTournamentMonth(meta.date);
    const ranking = await getRankingSnapshot(combinedType, snapshotMonth, dateISO);
    return computeTournamentRatingByName(allCouples, ranking, combinedType, snapshotMonth);
  } catch (err) {
    console.error("manual: field rating failed:", err);
    return null;
  }
}

// POST /api/manual/analyze — analyse a TopTurnier URL by the caller's name, save it
router.post(
  "/analyze",
  asyncHandler(async (req, res) => {
    const { url } = z.object({ url: z.string().url().max(500) }).parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { firstName: true, lastName: true },
    });
    if (!user) throw new HttpError(404, "User not found");

    let result;
    try {
      result = await topTurnierAnalytics(url, user.firstName, user.lastName);
    } catch (err) {
      if (err instanceof CoupleNotFoundError) throw new HttpError(404, err.message);
      throw err;
    }

    const { meta, analytics } = result;
    const rating = await fieldRating(meta, analytics.allCouples);

    const saved = await prisma.manualCompetition.upsert({
      where: { userId_sourceUrl: { userId: req.userId!, sourceUrl: url } },
      create: {
        userId: req.userId!,
        sourceUrl: url,
        competitionName: analytics.competitionName,
        date: meta.date,
        discipline: meta.discipline,
        category: meta.category,
        coupleName: analytics.coupleName,
        coupleNumber: analytics.coupleNumber,
        place: analytics.final ? String(analytics.final.overallPlace) : null,
        analytics: analytics as object,
        rating: (rating as object) ?? undefined,
      },
      update: {
        competitionName: analytics.competitionName,
        date: meta.date,
        discipline: meta.discipline,
        category: meta.category,
        coupleName: analytics.coupleName,
        coupleNumber: analytics.coupleNumber,
        place: analytics.final ? String(analytics.final.overallPlace) : null,
        analytics: analytics as object,
        rating: (rating as object) ?? undefined,
      },
    });

    res.json({ competition: saved });
  })
);

// GET /api/manual — list the caller's saved analyses (meta only)
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await prisma.manualCompetition.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, sourceUrl: true, competitionName: true, date: true,
        discipline: true, category: true, coupleName: true, coupleNumber: true,
        place: true, createdAt: true,
      },
    });
    res.json({ competitions: items });
  })
);

// GET /api/manual/:id — full saved record (analytics + rating)
router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const item = await prisma.manualCompetition.findFirst({
      where: { id, userId: req.userId },
    });
    if (!item) throw new HttpError(404, "Analysis not found");
    res.json({ competition: item });
  })
);

// GET /api/manual/:id/couple-scores?coupleNumber= — rival breakdown for the Compare tab
router.get(
  "/:id/couple-scores",
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { coupleNumber } = z.object({
      coupleNumber: z.string().min(1).max(10),
    }).parse(req.query);

    const item = await prisma.manualCompetition.findFirst({
      where: { id, userId: req.userId },
      select: { sourceUrl: true },
    });
    if (!item) throw new HttpError(404, "Analysis not found");

    const scores = await topTurnierCoupleScores(item.sourceUrl, coupleNumber);
    res.json({ scores });
  })
);

// DELETE /api/manual/:id
router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    await prisma.manualCompetition.deleteMany({
      where: { id, userId: req.userId },
    });
    res.status(204).end();
  })
);

export default router;
