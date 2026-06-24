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
  tqPs: number | null;
  mmCp: number | null;
  rank: number;
}

export interface Score3Dance {
  dance: string;
  judgeEntries: Score3JudgeEntry[];
  place: number;       // dance place in Final rounds; 0 for prelim
  totalMarks: number;  // total criteria marks in prelim rounds; 0 for Final
  totalScore: number;  // sum of all judge scores (multi-dance table layout); 0 otherwise
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

// ─── Store ────────────────────────────────────────────────────────────────────

interface WdsfState {
  profile: WdsfProfile | null;
  loading: boolean;
  error: string | null;
  analyticsCache: Record<string, CompetitionAnalytics | null>;
  analyticsLoading: Record<string, boolean>;

  fetchProfile: () => Promise<void>;
  linkByMin: (min: string) => Promise<void>;
  linkByUrl: (url: string, min?: string) => Promise<void>;
  refresh: () => Promise<void>;
  unlink: () => Promise<void>;
  fetchAnalytics: (competitionUrl: string) => Promise<CompetitionAnalytics | null>;
  clearAnalyticsCache: (competitionUrl: string) => void;
}

export const useWdsfStore = create<WdsfState>((set, get) => ({
  profile: null,
  loading: false,
  error: null,
  analyticsCache: {},
  analyticsLoading: {},

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
      set({ profile, analyticsCache: {} }); // clear analytics cache on refresh
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
      set({ profile: null, analyticsCache: {}, analyticsLoading: {} });
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
}));
