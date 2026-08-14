import { create } from "zustand";

type AuthState = {
  isUnlocked: boolean;
  unlock: () => void;
  lock: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  isUnlocked: false,

  unlock: () => set({ isUnlocked: true }),

  lock: () => set({ isUnlocked: false }),
}));
