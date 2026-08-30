import { create } from "zustand";

import type { ConfirmRequest } from "@/src/components/ConfirmDialog";

/** Everything about a confirmation except how it is answered. */
export type ConfirmOptions = Omit<ConfirmRequest, "onConfirm" | "onCancel">;

type ConfirmState = {
  request: ConfirmRequest | null;
  /**
   * Asks the question and resolves with the answer.
   *
   * A promise rather than callbacks so call sites read in the order things happen:
   *
   *   if (await confirm({ … })) await purge(id);
   *
   * which is as short as `Alert.alert` was, without handing the dialog's looks to
   * the platform.
   */
  ask: (options: ConfirmOptions) => Promise<boolean>;
  dismiss: () => void;
  /**
   * Answers any open question with "no" and closes it.
   *
   * Used when the app leaves the foreground. A `Modal` lives in its own window,
   * above the React tree, so the privacy shield cannot cover it — and a dialog can
   * be quoting a note's title. Closing it is what keeps that title out of the app
   * switcher's thumbnail.
   */
  cancelPending: () => void;
};

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  request: null,

  ask: (options) =>
    new Promise<boolean>((resolve) => {
      // A second question while one is open would replace it and leave the first
      // caller waiting forever. Answering "no" is the safe way to break the tie:
      // every confirmation in the app guards something destructive.
      const pending = get().request;

      if (pending) pending.onCancel?.();

      set({
        request: {
          ...options,
          onConfirm: () => resolve(true),
          onCancel: () => resolve(false),
        },
      });
    }),

  // Called by the dialog once it has already resolved the promise itself.
  dismiss: () => set({ request: null }),

  cancelPending: () => {
    const pending = get().request;

    if (!pending) return;

    // Resolve before clearing: dropping the request without answering it would
    // leave whoever asked awaiting a promise that can never settle.
    pending.onCancel?.();
    set({ request: null });
  },
}));

/** Shorthand for the common case, outside a component. */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().ask(options);
}
