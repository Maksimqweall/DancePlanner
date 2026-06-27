import { create } from "zustand";
import { api, setAuthToken } from "../lib/api";
import { tokenStorage } from "../lib/tokenStorage";
import { setDisplayCurrency } from "../lib/display";
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
  acceptPrivacy: () => Promise<void>;
  setMonthlyBudget: (budget: number) => Promise<void>;
  setCurrency: (currency: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, password: string) => Promise<void>;
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
      setDisplayCurrency(user.currency);
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
    setDisplayCurrency(user.currency);
    set({ status: "authenticated", user });
  },

  signup: async (input) => {
    const { token, user } = await api.post<AuthResponse>("/auth/signup", input);
    await tokenStorage.set(token);
    setAuthToken(token);
    setDisplayCurrency(user.currency);
    set({ status: "authenticated", user });
  },

  logout: async () => {
    await tokenStorage.clear();
    setAuthToken(null);
    set({ status: "unauthenticated", user: null });
  },

  acceptPrivacy: async () => {
    const { user } = await api.post<{ user: User }>("/auth/accept-privacy", {});
    set({ user });
  },

  setMonthlyBudget: async (budget) => {
    const { user } = await api.patch<{ user: User }>("/auth/me", { monthlyBudget: budget });
    set({ user });
  },

  setCurrency: async (currency) => {
    const { user } = await api.patch<{ user: User }>("/auth/me", { currency });
    setDisplayCurrency(user.currency);
    set({ user });
  },

  forgotPassword: async (email) => {
    await api.post("/auth/forgot-password", { email });
  },

  resetPassword: async (token, password) => {
    await api.post("/auth/reset-password", { token, password });
  },
}));
