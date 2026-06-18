import { create } from "zustand";
import { api, setAuthToken } from "../lib/api";
import { tokenStorage } from "../lib/tokenStorage";
import type { User } from "../lib/types";

type Status = "loading" | "authenticated" | "unauthenticated";

interface AuthState {
  status: Status;
  user: User | null;
  hydrate: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  setMonthlyBudget: (budget: number) => Promise<void>;
}

interface AuthResponse {
  token: string;
  user: User;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: "loading",
  user: null,

  // Restore a saved session on app start.
  hydrate: async () => {
    const token = await tokenStorage.get();
    if (!token) {
      set({ status: "unauthenticated", user: null });
      return;
    }
    setAuthToken(token);
    try {
      const { user } = await api.get<{ user: User }>("/auth/me");
      set({ status: "authenticated", user });
    } catch {
      await tokenStorage.clear();
      setAuthToken(null);
      set({ status: "unauthenticated", user: null });
    }
  },

  login: async (email, password) => {
    const { token, user } = await api.post<AuthResponse>("/auth/login", {
      email,
      password,
    });
    await tokenStorage.set(token);
    setAuthToken(token);
    set({ status: "authenticated", user });
  },

  signup: async (input) => {
    const { token, user } = await api.post<AuthResponse>("/auth/signup", input);
    await tokenStorage.set(token);
    setAuthToken(token);
    set({ status: "authenticated", user });
  },

  logout: async () => {
    await tokenStorage.clear();
    setAuthToken(null);
    set({ status: "unauthenticated", user: null });
  },

  setMonthlyBudget: async (budget) => {
    const { user } = await api.patch<{ user: User }>("/auth/me", { monthlyBudget: budget });
    set({ user });
  },
}));
