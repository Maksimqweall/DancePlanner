import { create } from "zustand";
import { api } from "../lib/api";
import type { ChatMessage } from "../lib/types";

interface ChatState {
  messages: ChatMessage[];
  unread: number;
  loading: boolean;
  loaded: boolean;

  fetch: () => Promise<void>;
  send: (body: string) => Promise<void>;
  markRead: () => Promise<void>;
  handleIncoming: () => void; // WS hint → refresh feed
  reset: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  unread: 0,
  loading: false,
  loaded: false,

  fetch: async () => {
    set({ loading: true });
    try {
      const data = await api.get<{ messages: ChatMessage[]; unread: number }>("/messages");
      set({ messages: data.messages, unread: data.unread, loaded: true });
    } catch {
      // not in a couple yet / offline — ignore
    } finally {
      set({ loading: false });
    }
  },

  send: async (body) => {
    const text = body.trim();
    if (!text) return;
    const { message } = await api.post<{ message: ChatMessage }>("/messages", { body: text });
    set((s) => ({ messages: [...s.messages, message] }));
  },

  markRead: async () => {
    set({ unread: 0 });
    try {
      await api.post("/messages/read", {});
    } catch {
      // best-effort
    }
  },

  // A new message arrived over the websocket — refresh the feed + unread count.
  handleIncoming: () => {
    get().fetch();
  },

  reset: () => set({ messages: [], unread: 0, loaded: false }),
}));
