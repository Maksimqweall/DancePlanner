import { create } from "zustand";
import { api } from "../lib/api";

export interface WdsfCompetition {
  date: string;
  event: string;
  location: string;
  discipline: string;
  category: string;
  place: string | null;
  points: string | null;
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
  // General section
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

interface WdsfState {
  profile: WdsfProfile | null;
  loading: boolean;
  error: string | null;

  fetchProfile: () => Promise<void>;
  linkByMin: (min: string) => Promise<void>;
  linkByUrl: (url: string, min?: string) => Promise<void>;
  refresh: () => Promise<void>;
  unlink: () => Promise<void>;
}

export const useWdsfStore = create<WdsfState>((set) => ({
  profile: null,
  loading: false,
  error: null,

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
      set({ profile });
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
      set({ profile: null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Failed to unlink" });
    } finally {
      set({ loading: false });
    }
  },
}));
