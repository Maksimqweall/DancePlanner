import { create } from "zustand";
import { api } from "../lib/api";

// ─── Base Profile Types ───────────────────────────────────────────────────────

export interface WdsfCompetition {
  date: string;
  event: string;
  location: string;
  discipline: string;
  category: string;
  place: string | null;
  points: string | null;
  competitionUrl: string | null;
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

// ─── Competition Analytics Types ──────────────────────────────────────────────

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

// ─── System 3.0 Types ─────────────────────────────────────────────────────────

export interface Score3JudgeEntry {
  judge: string;
  tqPs: number | null;  // combined "TQ & PS" value (2-column competitions)
  mmCp: number | null;  // combined "MM & CP" value (2-column competitions)
  tq: number | null;    // Technical Quality           (4-column competitions)
  mm: number | null;    // Movement to Music           (4-column competitions)
  ps: number | null;    // Partnering Skill            (4-column competitions)
  cp: number | null;    // Choreography & Presentation (4-column competitions)
  rank: number;
}

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
  place: number;       // dance place in Final rounds; 0 for prelim
  totalMarks: number;  // total criteria marks in prelim rounds; 0 for Final
  totalScore: number;  // dance total (sum of component scores), e.g. 38.200; 0 if unknown
  components: Score3Components; // per-criterion averages from the "Component score" row
  fourCriteria: boolean;        // true when the dance used 4 separate criteria columns
}

export interface Score3Round {
  roundName: string;
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
  final3: Score3Round | null;
  scores3: Scores3Result | null;
  danceStats: { dance: string; totalCrosses: number; avgPerRound: number }[];
  judgeStats: { judge: string; totalCrosses: number; pct: number }[];
  totalPossibleCrosses: number;
  reachedFinal: boolean;
  allCouples: RankingEntry[];
  judgeNames: Record<string, string>;
}

// ─── Tournament Rating (field-strength tier vs WDSF World Ranking) ─────────────

export type TournamentTier = "S" | "A" | "B" | "C" | "D" | "Unrated";

export interface TournamentRating {
  available: boolean;
  reason?: string;
  tier: TournamentTier;
  rating: number; // 0–10
  participants: number;
  n30: number;
  n50: number;
  n100: number;
  n200: number;
  bestRank: number | null;
  matched: { coupleName: string; worldRank: number; points: number }[];
  combinedType: string;
  snapshotMonth: string | null;
}

// One rival couple's full breakdown across both judging systems (for side-by-side comparison)
export interface CoupleScores {
  rounds: PrelimRound[];          // System 2.0 qualifying rounds (crosses)
  final: FinalResult | null;      // System 2.0 skating final
  scores3: Scores3Result | null;  // System 3.0 qualifying rounds
  final3: Score3Round | null;     // System 3.0 final
}

// ─── Couple Rating (overall 1–10 strength + world/regional rank) ───────────────

export interface CoupleRatingComponent {
  key: "avgPlace" | "tier" | "worldRank" | "upsets" | "finalsPodium" | "trend";
  label: string;
  weight: number;
  score: number; // 0..1
  detail: string;
}

export interface CoupleRatingPenalty {
  key: string;
  label: string;
  amount: number;
  detail: string;
}

export interface DeepEventSignal {
  event: string;
  date: string;
  tier: TournamentTier;
  eventRating: number;
  myPlace: number | null;
  fieldSize: number;
  myWorldRank: number | null;
  upsetWins: number;
  badLosses: number;
  roundOneExit: boolean;
  reachedFinal: boolean;
}

export interface CoupleRating {
  available: boolean;
  reason?: string;
  rating: number; // 1..10
  tier: TournamentTier;
  baseRating: number;
  worldRank: number | null;
  regionalRank: number | null;
  region: string | null;
  components: CoupleRatingComponent[];
  penalties: CoupleRatingPenalty[];
  bonuses: CoupleRatingPenalty[];
  stats: {
    competitionsConsidered: number;
    avgPlace: number | null;
    finals: number;
    podiums: number;
    firstPlaces: number;
    monthsSinceLast: number | null;
    recentAvgPlace: number | null;
    olderAvgPlace: number | null;
    deepEventsAnalyzed: number;
    upsetWins: number;
    badLosses: number;
    roundOneExits: number;
  };
  events: DeepEventSignal[];
}

// ─── Leaderboard (global ranking of WDSF-linked users) ─────────────────────────

export interface LeaderboardRow {
  position: number;
  userId: string;
  name: string;
  rating: number; // 1..10
  tier: TournamentTier;
  region: string | null;
  worldRank: number | null;
  deep: boolean; // computed with deep event analysis
  isMe: boolean;
}

// ─── Store ────────────────────────────────────────────────────────────────────

interface WdsfState {
  profile: WdsfProfile | null;
  loading: boolean;
  error: string | null;
  analyticsCache: Record<string, CompetitionAnalytics | null>;
  analyticsLoading: Record<string, boolean>;
  coupleScoresCache: Record<string, CoupleScores | null>;
  coupleScoresLoading: Record<string, boolean>;
  ratingCache: Record<string, TournamentRating | null>;
  ratingLoading: Record<string, boolean>;
  coupleRating: CoupleRating | null;
  coupleRatingLoading: boolean;
  coupleRatingError: string | null;
  leaderboard: LeaderboardRow[] | null;
  leaderboardLoading: boolean;
  leaderboardError: string | null;

  fetchProfile: () => Promise<void>;
  linkByMin: (min: string) => Promise<void>;
  linkByUrl: (url: string, min?: string) => Promise<void>;
  refresh: () => Promise<void>;
  unlink: () => Promise<void>;
  fetchAnalytics: (competitionUrl: string) => Promise<CompetitionAnalytics | null>;
  clearAnalyticsCache: (competitionUrl: string) => void;
  fetchCoupleScores: (competitionUrl: string, coupleNumber: string) => Promise<CoupleScores | null>;
  fetchTournamentRating: (
    competitionUrl: string,
    category: string,
    discipline: string,
    date?: string,
  ) => Promise<TournamentRating | null>;
  fetchCoupleRating: (force?: boolean) => Promise<CoupleRating | null>;
  fetchLeaderboard: (force?: boolean) => Promise<LeaderboardRow[] | null>;
}

export const useWdsfStore = create<WdsfState>((set, get) => ({
  profile: null,
  loading: false,
  error: null,
  analyticsCache: {},
  analyticsLoading: {},
  coupleScoresCache: {},
  coupleScoresLoading: {},
  ratingCache: {},
  ratingLoading: {},
  coupleRating: null,
  coupleRatingLoading: false,
  coupleRatingError: null,
  leaderboard: null,
  leaderboardLoading: false,
  leaderboardError: null,

  fetchProfile: async () => {
    set({ loading: true, error: null });
    try {
      const { profile } = await api.get<{ profile: WdsfProfile | null }>("/wdsf/profile");
      set({ profile });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Failed to load profile" });
    } finally {
      set({ loading: false });
    }
  },

  linkByMin: async (min) => {
    set({ loading: true, error: null });
    try {
      const { profile } = await api.post<{ profile: WdsfProfile }>("/wdsf/link", { min });
      set({ profile });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Failed to link profile" });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  linkByUrl: async (url, min) => {
    set({ loading: true, error: null });
    try {
      const { profile } = await api.post<{ profile: WdsfProfile }>("/wdsf/link-url", { url, min });
      set({ profile });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Failed to link profile" });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      const { profile } = await api.post<{ profile: WdsfProfile }>("/wdsf/refresh");
      set({ profile, analyticsCache: {}, ratingCache: {}, coupleRating: null }); // clear caches on refresh
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Refresh failed" });
    } finally {
      set({ loading: false });
    }
  },

  unlink: async () => {
    set({ loading: true, error: null });
    try {
      await api.del("/wdsf/unlink");
      set({ profile: null, analyticsCache: {}, analyticsLoading: {}, ratingCache: {}, ratingLoading: {}, coupleRating: null, coupleRatingError: null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Failed to unlink" });
    } finally {
      set({ loading: false });
    }
  },

  clearAnalyticsCache: (competitionUrl: string) => {
    set(s => {
      const next = { ...s.analyticsCache };
      delete next[competitionUrl];
      return { analyticsCache: next };
    });
  },

  fetchAnalytics: async (competitionUrl: string) => {
    const cached = get().analyticsCache[competitionUrl];
    if (cached !== undefined) return cached;

    set(s => ({ analyticsLoading: { ...s.analyticsLoading, [competitionUrl]: true } }));
    try {
      const params = new URLSearchParams({ competitionUrl });
      const { analytics } = await api.get<{ analytics: CompetitionAnalytics }>(
        `/wdsf/competition-analytics?${params}`
      );
      set(s => ({
        analyticsCache: { ...s.analyticsCache, [competitionUrl]: analytics },
        analyticsLoading: { ...s.analyticsLoading, [competitionUrl]: false },
      }));
      return analytics;
    } catch {
      set(s => ({
        analyticsCache: { ...s.analyticsCache, [competitionUrl]: null },
        analyticsLoading: { ...s.analyticsLoading, [competitionUrl]: false },
      }));
      return null;
    }
  },

  fetchCoupleScores: async (competitionUrl: string, coupleNumber: string) => {
    const key = `${competitionUrl}|${coupleNumber}`;
    const cached = get().coupleScoresCache[key];
    if (cached !== undefined) return cached;

    set(s => ({ coupleScoresLoading: { ...s.coupleScoresLoading, [key]: true } }));
    try {
      const params = new URLSearchParams({ competitionUrl, coupleNumber });
      const { scores } = await api.get<{ scores: CoupleScores }>(
        `/wdsf/couple-scores?${params}`
      );
      set(s => ({
        coupleScoresCache: { ...s.coupleScoresCache, [key]: scores },
        coupleScoresLoading: { ...s.coupleScoresLoading, [key]: false },
      }));
      return scores;
    } catch {
      set(s => ({
        coupleScoresCache: { ...s.coupleScoresCache, [key]: null },
        coupleScoresLoading: { ...s.coupleScoresLoading, [key]: false },
      }));
      return null;
    }
  },

  fetchTournamentRating: async (competitionUrl, category, discipline, date) => {
    const key = `${competitionUrl}|${category}|${discipline}`;
    const cached = get().ratingCache[key];
    if (cached !== undefined) return cached;

    set(s => ({ ratingLoading: { ...s.ratingLoading, [key]: true } }));
    try {
      const params = new URLSearchParams({ competitionUrl, category, discipline });
      if (date) params.set("date", date);
      const { rating } = await api.get<{ rating: TournamentRating }>(
        `/wdsf/tournament-rating?${params}`
      );
      set(s => ({
        ratingCache: { ...s.ratingCache, [key]: rating },
        ratingLoading: { ...s.ratingLoading, [key]: false },
      }));
      return rating;
    } catch {
      set(s => ({
        ratingCache: { ...s.ratingCache, [key]: null },
        ratingLoading: { ...s.ratingLoading, [key]: false },
      }));
      return null;
    }
  },

  fetchCoupleRating: async (force = false) => {
    const existing = get().coupleRating;
    if (existing && !force) return existing;

    set({ coupleRatingLoading: true, coupleRatingError: null });
    try {
      const { rating } = await api.get<{ rating: CoupleRating }>("/wdsf/couple-rating");
      set({ coupleRating: rating, coupleRatingLoading: false });
      return rating;
    } catch (e) {
      set({
        coupleRatingError: e instanceof Error ? e.message : "Failed to compute rating",
        coupleRatingLoading: false,
      });
      return null;
    }
  },

  fetchLeaderboard: async (force = false) => {
    const existing = get().leaderboard;
    if (existing && !force) return existing;

    set({ leaderboardLoading: true, leaderboardError: null });
    try {
      const { leaderboard } = await api.get<{ leaderboard: LeaderboardRow[] }>(
        force ? "/wdsf/leaderboard?refresh=1" : "/wdsf/leaderboard",
      );
      set({ leaderboard, leaderboardLoading: false });
      return leaderboard;
    } catch (e) {
      set({
        leaderboardError: e instanceof Error ? e.message : "Failed to load leaderboard",
        leaderboardLoading: false,
      });
      return null;
    }
  },
}));
