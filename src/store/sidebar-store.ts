import { create } from "zustand";

type SidebarState = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

/**
 * Whether the sidebar is showing.
 *
 * A store rather than layout state because the button that opens it lives inside
 * whichever screen is on top, and the panel itself is rendered once by the group
 * layout — passing a callback down through the navigator to reach it would mean
 * threading props through routes that have nothing to do with navigation.
 */
export const useSidebarStore = create<SidebarState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
