import { create } from "zustand";

import * as authService from "@/src/services/auth-service";
import type { Capability } from "@/src/services/auth-service";

/**
 * The screen shows a distinct treatment for each of these, so they are modelled
 * explicitly rather than collapsed into a boolean plus an error string.
 */
export type AuthStatus =
  | "probing"
  | "locked"
  | "authenticating"
  | "unlocked"
  | "failed"
  | "cancelled"
  | "lockedOut"
  | "notEnrolled"
  | "unavailable";

type AuthState = {
  status: AuthStatus;
  /**
   * Drives the route guard in the root layout.
   *
   * Not simply `status === "unlocked"`: on success it lags the status by one
   * animation beat so the confirmation is visible before the navigator swaps
   * screens. Keeping it a separate boolean also means the navigator re-renders
   * only when access actually changes, not on every intermediate status.
   */
  isUnlocked: boolean;
  capability: Capability | null;
  /** User-facing explanation for the current status, when one is warranted. */
  message: string | null;
  failedAttempts: number;

  probe: () => Promise<void>;
  /**
   * Opens the biometric prompt. Takes no options: every unlock action in the UI
   * funnels through this one path.
   */
  authenticate: () => Promise<void>;
  lock: () => void;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "probing",
  isUnlocked: false,
  capability: null,
  message: null,
  failedAttempts: 0,

  /**
   * Establishes what this device can actually do before offering to unlock.
   * Without it the screen would advertise a fingerprint button on hardware that
   * has no sensor, and only discover the problem after a tap.
   */
  probe: async () => {
    set({ status: "probing", message: null });

    try {
      const capability = await authService.probeCapability();

      if (!capability.hasHardware) {
        set({
          status: "unavailable",
          capability,
          message: capability.hasDeviceCredential
            ? "This device has no biometric sensor. Use your device PIN instead."
            : "This device has no biometric sensor, and no screen lock is set.",
        });
        return;
      }

      if (!capability.isEnrolled) {
        set({
          status: "notEnrolled",
          capability,
          message:
            "No biometrics are enrolled yet. Add one in Android Settings, or use your device PIN.",
        });
        return;
      }

      set({ status: "locked", capability, message: null });
    } catch {
      set({
        status: "unavailable",
        message: "Couldn’t check this device’s security settings.",
      });
    }
  },

  authenticate: async () => {
    // Guard against a second prompt while one is already open — double taps on
    // the unlock button would otherwise stack native dialogs.
    if (get().status === "authenticating") return;

    set({ status: "authenticating", message: null });

    const outcome = await authService.authenticate();

    switch (outcome.kind) {
      case "success":
        set({ status: "unlocked", message: null, failedAttempts: 0 });

        // Hold for one beat before flipping the guard. The route change unmounts
        // this screen instantly, so without the pause the success confirmation
        // would be rendered and destroyed in the same frame — never actually
        // seen. This is the one place a deliberate delay earns its cost.
        await new Promise((resolve) => setTimeout(resolve, 340));

        set({ isUnlocked: true });
        return;

      case "cancelled":
        // Not a failure, but it still needs saying — a screen that silently
        // returned to rest would look like the tap did nothing.
        set({
          status: "cancelled",
          message: "Authentication was cancelled. Your notes stay locked.",
        });
        return;

      case "failed":
        set((state) => ({
          status: "failed",
          message: outcome.message,
          failedAttempts: state.failedAttempts + 1,
        }));
        return;

      case "lockedOut":
        set({
          status: "lockedOut",
          message: outcome.permanent
            ? "Too many attempts. Unlock your device with its PIN to re-enable biometrics."
            : "Too many attempts. Biometrics are locked for a moment — try your device PIN.",
        });
        return;

      case "notEnrolled":
        set({
          status: "notEnrolled",
          message:
            "No biometrics are enrolled yet. Add one in Android Settings, or use your device PIN.",
        });
        return;

      case "noDeviceCredential":
        set({
          status: "unavailable",
          message:
            "No screen lock is set on this device, so there is nothing to verify against.",
        });
        return;

      case "unavailable":
        set({
          status: "unavailable",
          message: "Biometric authentication isn’t available right now.",
        });
        return;
    }
  },

  lock: () =>
    set({
      status: "locked",
      isUnlocked: false,
      message: null,
      failedAttempts: 0,
    }),
}));
