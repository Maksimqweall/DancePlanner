import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Tracks which contextual hints a user has dismissed, so first-time tips show once
// and then stay out of the way. Each hint has a stable string id (see <Hint id=…>).
interface HintsState {
  dismissed: Record<string, true>;
  isDismissed: (id: string) => boolean;
  dismiss: (id: string) => void;
  resetHints: () => void;
}

export const useHintsStore = create<HintsState>()(
  persist(
    (set, get) => ({
      dismissed: {},
      isDismissed: (id) => !!get().dismissed[id],
      dismiss: (id) =>
        set((st) => ({ dismissed: { ...st.dismissed, [id]: true } })),
      resetHints: () => set({ dismissed: {} }),
    }),
    {
      name: "danceplanner.hints",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
