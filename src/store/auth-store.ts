import { create } from "zustand";

import * as authService from "@/src/services/auth-service";
import type { Capability, OS } from "@/src/services/auth-service";

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
  /** Which platform's vocabulary to use; set when the device is probed. */
  platform: OS;
  /** User-facing explanation for the current status, when one is warranted. */
  message: string | null;

  probe: (platform?: OS) => Promise<void>;
  /** Opens the platform's biometric prompt. */
  authenticate: () => Promise<void>;
  lock: () => void;
};

/** How long "Unlocked." stays on screen before the guard opens. */
const CONFIRMATION_BEAT = 340;

/**
 * Which unlock attempt is current.
 *
 * `authenticate` waits out the confirmation beat before opening the guard, and
 * `lock` can land inside that gap — the app going to the background between a
 * successful fingerprint and the navigator switching screens. Without this the
 * pending `setTimeout` would flip the guard open afterwards, unlocking the app
 * while it sat in the background. Bumping the token makes a superseded attempt
 * finish quietly instead.
 */
let attempt = 0;

/**
 * Biometrics are the only way into Noting.
 *
 * When the sensor cannot be used at all, the way through is the device's own PIN
 * or pattern, which the platform offers inside its prompt — see `authenticate` in
 * `auth-service`. The app has no credential of its own, so there is nothing here
 * that unlocks the notes without the platform agreeing to it first.
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  status: "probing",
  isUnlocked: false,
  capability: null,
  platform: "android",
  message: null,

  /**
   * Establishes what this device can actually do before offering to unlock.
   * Without it the screen would advertise a fingerprint button on hardware that
   * has no sensor, and only discover the problem after a tap.
   */
  probe: async (platform) => {
    set({
      status: "probing",
      message: null,
      ...(platform ? { platform } : {}),
    });

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
            "No biometrics are enrolled yet. Add one in your device settings, or use your device PIN.",
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

    const token = ++attempt;

    set({ status: "authenticating", message: null });

    const { capability, platform } = get();
    const outcome = await authService.authenticate(
      capability?.primary ?? null,
      platform,
    );

    // Locked, or superseded by a newer attempt, while the prompt was open.
    if (token !== attempt) return;

    switch (outcome.kind) {
      case "success":
        set({ status: "unlocked", message: null });

        // Hold for one beat before flipping the guard. The route change unmounts
        // this screen instantly, so without the pause the success confirmation
        // would be rendered and destroyed in the same frame — never actually
        // seen. This is the one place a deliberate delay earns its cost.
        await new Promise((resolve) => setTimeout(resolve, CONFIRMATION_BEAT));

        if (token !== attempt) return;

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
        set({ status: "failed", message: outcome.message });
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
            "No biometrics are enrolled yet. Add one in your device settings, or use your device PIN.",
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

  lock: () => {
    // Invalidates any attempt still in flight, including one waiting out the
    // confirmation beat.
    attempt++;

    set({
      status: "locked",
      isUnlocked: false,
      message: null,
    });
  },
}));
