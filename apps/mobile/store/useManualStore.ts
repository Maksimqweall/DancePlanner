import { create } from "zustand";
import { api } from "../lib/api";
import type { CompetitionAnalytics, CoupleScores, TournamentRating } from "./useWdsfStore";

// ─── Manual (TopTurnier) competition analysis ──────────────────────────────────
// Mirrors the WDSF analytics flow, but the user pastes any TopTurnier results URL
// and their couple is found by account name. Saved analyses persist server-side so
// they can be reopened later.

// List-row (meta only — no heavy analytics payload).
export interface ManualCompetitionMeta {
  id: string;
  sourceUrl: string;
  competitionName: string;
  date: string | null;
  discipline: string | null;
  category: string | null;
  coupleName: string;
  coupleNumber: string;
  place: string | null;
  createdAt: string;
}

// Full saved record (analytics + field rating).
export interface ManualCompetition extends ManualCompetitionMeta {
  analytics: CompetitionAnalytics;
  rating: TournamentRating | null;
}

interface ManualState {
  list: ManualCompetitionMeta[];
  listLoading: boolean;
  analyzing: boolean;
  analyzeError: string | null;
  detailCache: Record<string, ManualCompetition>;

  fetchList: () => Promise<void>;
  analyze: (url: string) => Promise<ManualCompetition | null>;
  getDetail: (id: string) => Promise<ManualCompetition | null>;
  remove: (id: string) => Promise<void>;
  fetchCoupleScores: (id: string, coupleNumber: string) => Promise<CoupleScores | null>;
  clearError: () => void;
}

export const useManualStore = create<ManualState>((set, get) => ({
  list: [],
  listLoading: false,
  analyzing: false,
  analyzeError: null,
  detailCache: {},

  fetchList: async () => {
    set({ listLoading: true });
    try {
      const { competitions } = await api.get<{ competitions: ManualCompetitionMeta[] }>("/manual");
      set({ list: competitions, listLoading: false });
    } catch {
      set({ listLoading: false });
    }
  },

  analyze: async (url: string) => {
    set({ analyzing: true, analyzeError: null });
    try {
      const { competition } = await api.post<{ competition: ManualCompetition }>("/manual/analyze", { url });
      set((s) => ({
        analyzing: false,
        detailCache: { ...s.detailCache, [competition.id]: competition },
        // Put the new/updated record at the top of the list (de-duplicated by id).
        list: [
          stripDetail(competition),
          ...s.list.filter((c) => c.id !== competition.id),
        ],
      }));
      return competition;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not analyze this competition.";
      set({ analyzing: false, analyzeError: message });
      return null;
    }
  },

  getDetail: async (id: string) => {
    const cached = get().detailCache[id];
    if (cached) return cached;
    try {
      const { competition } = await api.get<{ competition: ManualCompetition }>(`/manual/${id}`);
      set((s) => ({ detailCache: { ...s.detailCache, [id]: competition } }));
      return competition;
    } catch {
      return null;
    }
  },

  remove: async (id: string) => {
    try {
      await api.del(`/manual/${id}`);
    } catch { /* ignore — still drop locally */ }
    set((s) => {
      const next = { ...s.detailCache };
      delete next[id];
      return { list: s.list.filter((c) => c.id !== id), detailCache: next };
    });
  },

  fetchCoupleScores: async (id: string, coupleNumber: string) => {
    try {
      const params = new URLSearchParams({ coupleNumber });
      const { scores } = await api.get<{ scores: CoupleScores }>(`/manual/${id}/couple-scores?${params}`);
      return scores;
    } catch {
      return null;
    }
  },

  clearError: () => set({ analyzeError: null }),
}));

function stripDetail(c: ManualCompetition): ManualCompetitionMeta {
  const { analytics: _a, rating: _r, ...meta } = c;
  return meta;
}
