import { create } from "zustand";
import { api } from "../lib/api";
import { useAuthStore } from "./useAuthStore";
import type { Couple, Proposal, SplitView } from "../lib/types";

export interface CreateProposalInput {
  title: string;
  type: string;
  cost?: number | null;
  currency?: string;
  details?: {
    date?: string;
    startTime?: string;
    notes?: string;
    location?: string;
    trainerName?: string;
    hotelName?: string;
  };
}

interface PartnerState {
  couple: Couple | null;
  pendingCount: number;
  proposals: Proposal[];
  split: SplitView | null;
  loading: boolean;

  fetchPartner: () => Promise<void>;
  linkPartner: (email: string) => Promise<void>;
  unlinkPartner: () => Promise<void>;

  fetchProposals: (direction?: "inbox" | "sent" | "all") => Promise<void>;
  createProposal: (input: CreateProposalInput) => Promise<void>;
  respondProposal: (id: string, action: "APPROVE" | "DECLINE") => Promise<void>;
  cancelProposal: (id: string) => Promise<void>;

  fetchSplit: () => Promise<void>;
}

export const usePartnerStore = create<PartnerState>((set, get) => ({
  couple: null,
  pendingCount: 0,
  proposals: [],
  split: null,
  loading: false,

  fetchPartner: async () => {
    set({ loading: true });
    try {
      const data = await api.get<{ couple: Couple | null; pendingCount: number }>("/partner");
      set({ couple: data.couple, pendingCount: data.pendingCount });
    } finally {
      set({ loading: false });
    }
  },

  linkPartner: async (email) => {
    const data = await api.post<{ couple: Couple }>("/partner/link", { email });
    set({ couple: data.couple, pendingCount: 0 });
  },

  unlinkPartner: async () => {
    await api.del("/partner");
    set({ couple: null, proposals: [], split: null, pendingCount: 0 });
  },

  fetchProposals: async (direction = "all") => {
    const { proposals } = await api.get<{ proposals: Proposal[] }>(
      `/proposals?direction=${direction}`
    );
    // Inbox badge = proposals awaiting MY response, i.e. ones I did not send.
    const myId = useAuthStore.getState().user?.id;
    const pending = proposals.filter(
      (p) => p.status === "PENDING" && p.senderId !== myId
    ).length;
    set({ proposals, pendingCount: pending });
  },

  createProposal: async (input) => {
    await api.post("/proposals", input);
    await get().fetchProposals();
  },

  respondProposal: async (id, action) => {
    await api.patch(`/proposals/${id}/respond`, { action });
    await get().fetchProposals();
  },

  cancelProposal: async (id) => {
    await api.del(`/proposals/${id}`);
    set((s) => ({ proposals: s.proposals.filter((p) => p.id !== id) }));
  },

  fetchSplit: async () => {
    try {
      const data = await api.get<SplitView>("/partner/split");
      set({ split: data });
    } catch {
      // not in a couple yet — ignore
    }
  },
}));
