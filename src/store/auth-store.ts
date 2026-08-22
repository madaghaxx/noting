import { create } from "zustand";

import * as authService from "@/src/services/auth-service";
import type { Capability, OS } from "@/src/services/auth-service";
import * as passcodeService from "@/src/services/passcode-service";

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
  failedAttempts: number;

  /** Whether Noting's own passcode is configured. */
  hasPasscode: boolean;
  /** A passcode check is running. The derivation is deliberately not instant. */
  checkingPasscode: boolean;
  /** Epoch milliseconds until which passcode entry is refused; 0 when open. */
  passcodeLockedUntil: number;
  passcodeAttemptsLeft: number;

  probe: (platform?: OS) => Promise<void>;
  /** Opens the platform's biometric prompt. */
  authenticate: () => Promise<void>;
  /** Checks Noting's passcode. Returns whether it was accepted. */
  submitPasscode: (code: string) => Promise<boolean>;
  /** Re-reads whether a passcode exists, after settings change it. */
  refreshPasscode: () => Promise<void>;
  lock: () => void;
};

/** How long "Unlocked." stays on screen before the guard opens. */
const CONFIRMATION_BEAT = 340;

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "probing",
  isUnlocked: false,
  capability: null,
  platform: "android",
  message: null,
  failedAttempts: 0,

  hasPasscode: false,
  checkingPasscode: false,
  passcodeLockedUntil: 0,
  passcodeAttemptsLeft: 5,

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

    // Read alongside the hardware probe: the unlock screen has to know about both
    // ways in before it draws anything, or the passcode button would appear a beat
    // after the biometric one.
    const [hasPasscode, guard] = await Promise.all([
      passcodeService.hasPasscode(),
      passcodeService.readGuard(),
    ]);

    set({
      hasPasscode,
      passcodeLockedUntil: guard.lockedUntil,
      passcodeAttemptsLeft: passcodeService.attemptsRemaining(guard),
    });

    try {
      const capability = await authService.probeCapability();

      if (!capability.hasHardware) {
        set({
          status: "unavailable",
          capability,
          message: hasPasscode
            ? "This device has no biometric sensor. Use your passcode instead."
            : capability.hasDeviceCredential
              ? "This device has no biometric sensor. Use your device PIN instead."
              : "This device has no biometric sensor, and no screen lock is set.",
        });
        return;
      }

      if (!capability.isEnrolled) {
        set({
          status: "notEnrolled",
          capability,
          message: hasPasscode
            ? "No biometrics are enrolled on this device. Use your passcode instead."
            : "No biometrics are enrolled yet. Add one in your device settings, or use your device PIN.",
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

    const { capability, platform } = get();
    const outcome = await authService.authenticate(
      capability?.primary ?? null,
      platform,
    );

    switch (outcome.kind) {
      case "success":
        set({ status: "unlocked", message: null, failedAttempts: 0 });

        // Hold for one beat before flipping the guard. The route change unmounts
        // this screen instantly, so without the pause the success confirmation
        // would be rendered and destroyed in the same frame — never actually
        // seen. This is the one place a deliberate delay earns its cost.
        await new Promise((resolve) => setTimeout(resolve, CONFIRMATION_BEAT));

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
          message: get().hasPasscode
            ? "Too many attempts. Use your passcode instead."
            : outcome.permanent
              ? "Too many attempts. Unlock your device with its PIN to re-enable biometrics."
              : "Too many attempts. Biometrics are locked for a moment — try your device PIN.",
        });
        return;

      case "notEnrolled":
        set({
          status: "notEnrolled",
          message: get().hasPasscode
            ? "No biometrics are enrolled on this device. Use your passcode instead."
            : "No biometrics are enrolled yet. Add one in your device settings, or use your device PIN.",
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

  /**
   * Checks Noting's own passcode.
   *
   * Kept entirely separate from the biometric path: a device whose sensor is
   * locked out, unenrolled or absent still has to be able to open its notes, and
   * that is the whole reason this exists. The code itself is never stored in state
   * — it arrives as an argument and is gone when this returns.
   */
  submitPasscode: async (code) => {
    if (get().checkingPasscode) return false;

    const now = Date.now();
    const waiting = get().passcodeLockedUntil - now;

    if (waiting > 0) {
      set({
        status: "failed",
        message: `Too many attempts. Try again in ${Math.ceil(waiting / 1000)}s.`,
      });
      return false;
    }

    set({ checkingPasscode: true, message: null });

    const accepted = await passcodeService.verifyPasscode(code);

    if (accepted) {
      await passcodeService.clearGuard();

      set({
        checkingPasscode: false,
        status: "unlocked",
        message: null,
        failedAttempts: 0,
        passcodeLockedUntil: 0,
        passcodeAttemptsLeft: 5,
      });

      await new Promise((resolve) => setTimeout(resolve, CONFIRMATION_BEAT));

      set({ isUnlocked: true });

      return true;
    }

    const guard = await passcodeService.noteFailure(Date.now());
    const cooldown = passcodeService.remainingLockout(guard, Date.now());

    set({
      checkingPasscode: false,
      status: "failed",
      passcodeLockedUntil: guard.lockedUntil,
      passcodeAttemptsLeft: passcodeService.attemptsRemaining(guard),
      message:
        cooldown > 0
          ? `Too many attempts. Try again in ${Math.ceil(cooldown / 1000)}s.`
          : "That passcode didn’t match. Try again.",
    });

    return false;
  },

  refreshPasscode: async () => {
    set({ hasPasscode: await passcodeService.hasPasscode() });
  },

  lock: () =>
    set({
      status: "locked",
      isUnlocked: false,
      message: null,
      failedAttempts: 0,
      checkingPasscode: false,
    }),
}));
