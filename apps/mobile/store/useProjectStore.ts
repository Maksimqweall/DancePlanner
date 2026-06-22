import { create } from "zustand";
import { api, type UploadFile } from "../lib/api";
import type { Project, EventType } from "../lib/types";
import type { CreateExpenseInput } from "./useFinanceStore";

export interface CreateProjectInput {
  title: string;
  type: EventType;
  date: string; // ISO
  endDate?: string | null;
  location?: string | null;
  budget?: number | null;
  hotelName?: string | null;
  hotelAddress?: string | null;
  checkIn?: string | null;
  checkOut?: string | null;
}

interface ProjectState {
  projects: Project[];
  current: Project | null;
  loading: boolean;

  refreshProjects: () => Promise<void>;
  fetchProject: (id: string) => Promise<void>;
  createProject: (input: CreateProjectInput) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;

  addChecklistItem: (eventId: string, text: string) => Promise<void>;
  toggleChecklistItem: (eventId: string, itemId: string, isDone: boolean) => Promise<void>;
  deleteChecklistItem: (eventId: string, itemId: string) => Promise<void>;

  uploadAttachment: (eventId: string, file: UploadFile, label: string) => Promise<void>;
  deleteAttachment: (eventId: string, attId: string) => Promise<void>;

  updateProject: (id: string, input: Partial<CreateProjectInput>) => Promise<void>;

  createProjectExpense: (eventId: string, input: CreateExpenseInput) => Promise<void>;
  updateProjectExpense: (eventId: string, expenseId: string, input: Partial<CreateExpenseInput>) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  current: null,
  loading: false,

  refreshProjects: async () => {
    set({ loading: true });
    try {
      const { events } = await api.get<{ events: Project[] }>("/events");
      set({ projects: events });
    } finally {
      set({ loading: false });
    }
  },

  fetchProject: async (id) => {
    set({ loading: true });
    try {
      const { event } = await api.get<{ event: Project }>(`/events/${id}`);
      set({ current: event });
    } finally {
      set({ loading: false });
    }
  },

  createProject: async (input) => {
    const { event } = await api.post<{ event: Project }>("/events", input);
    await get().refreshProjects();
    return event;
  },

  deleteProject: async (id) => {
    await api.del(`/events/${id}`);
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      current: state.current?.id === id ? null : state.current,
    }));
  },

  addChecklistItem: async (eventId, text) => {
    await api.post(`/events/${eventId}/checklist`, { text });
    await get().fetchProject(eventId);
  },

  toggleChecklistItem: async (eventId, itemId, isDone) => {
    await api.patch(`/events/${eventId}/checklist/${itemId}`, { isDone });
    await get().fetchProject(eventId);
  },

  deleteChecklistItem: async (eventId, itemId) => {
    await api.del(`/events/${eventId}/checklist/${itemId}`);
    await get().fetchProject(eventId);
  },

  uploadAttachment: async (eventId, file, label) => {
    await api.upload(`/events/${eventId}/attachments`, file, { label });
    await get().fetchProject(eventId);
  },

  deleteAttachment: async (eventId, attId) => {
    await api.del(`/events/${eventId}/attachments/${attId}`);
    await get().fetchProject(eventId);
  },

  updateProject: async (id, input) => {
    await api.patch(`/events/${id}`, input);
    await get().refreshProjects();
    if (get().current?.id === id) await get().fetchProject(id);
  },

  createProjectExpense: async (eventId, input) => {
    await api.post("/expenses", { ...input, eventId });
    await get().fetchProject(eventId);
  },

  updateProjectExpense: async (eventId, expenseId, input) => {
    await api.patch(`/expenses/${expenseId}`, input);
    await get().fetchProject(eventId);
  },
}));
