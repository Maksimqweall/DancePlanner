import { create } from "zustand";
import { api } from "../lib/api";
import { useAuthStore } from "./useAuthStore";
import type { Couple, Proposal, SplitView, SyncInvite } from "../lib/types";

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
  invitesReceived: SyncInvite[];
  invitesSent: SyncInvite[];

  fetchPartner: () => Promise<void>;
  unlinkPartner: () => Promise<void>;
  removeCoach: () => Promise<void>;

  fetchInvites: () => Promise<void>;
  sendPartnerInvite: (email: string) => Promise<void>;
  sendCoachInvite: (email: string) => Promise<void>;
  respondInvite: (id: string, action: "accept" | "decline") => Promise<void>;
  cancelInvite: (id: string) => Promise<void>;

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
  invitesReceived: [],
  invitesSent: [],

  fetchPartner: async () => {
    set({ loading: true });
    try {
      const data = await api.get<{ couple: Couple | null; pendingCount: number }>("/partner");
      set({ couple: data.couple, pendingCount: data.pendingCount });
    } finally {
      set({ loading: false });
    }
  },

  unlinkPartner: async () => {
    await api.del("/partner");
    set({ couple: null, proposals: [], split: null, pendingCount: 0 });
  },

  removeCoach: async () => {
    await api.del("/partner/coach");
    await get().fetchPartner();
  },

  fetchInvites: async () => {
    const data = await api.get<{ received: SyncInvite[]; sent: SyncInvite[] }>("/partner/invites");
    set({ invitesReceived: data.received, invitesSent: data.sent });
  },

  sendPartnerInvite: async (email) => {
    await api.post("/partner/invite", { email });
    await get().fetchInvites();
  },

  sendCoachInvite: async (email) => {
    await api.post("/partner/coach-invite", { email });
    await get().fetchInvites();
  },

  respondInvite: async (id, action) => {
    await api.post(`/partner/invites/${id}/${action}`, {});
    await get().fetchInvites();
    if (action === "accept") await get().fetchPartner();
  },

  cancelInvite: async (id) => {
    await api.del(`/partner/invites/${id}`);
    set((s) => ({
      invitesSent: s.invitesSent.filter((i) => i.id !== id),
    }));
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
