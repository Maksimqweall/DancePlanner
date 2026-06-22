import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { asyncHandler, HttpError } from "../lib/http";
import { prisma } from "../prisma";
import {
  findAthleteUrlByName,
  scrapeAthleteProfile,
  verifyAndScrape,
  extractUuid,
  type WdsfProfile,
} from "../lib/wdsfScraper";

const router = Router();
router.use(requireAuth);

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

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
