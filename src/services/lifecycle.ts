import type { AppStateStatus } from "react-native";

/**
 * What a change in app lifecycle should do to the lock.
 *
 * Pulled out as a pure function because the interesting part is not the
 * subscription — it is the rules, and the rules have a trap in them: the system's
 * own credential screen takes the app out of the foreground, so an app that locks
 * on every background event locks itself out of the authentication it just started
 * and can never be unlocked.
 */
export type LockDecision =
  /** Leave the foreground for real: clear the notes and require auth again. */
  | "lock"
  /** Cover the content, without locking yet. */
  | "shield"
  /** Back in the foreground: uncover. */
  | "reveal"
  | "ignore";

export function decideForAppState(
  next: AppStateStatus,
  context: {
    isUnlocked: boolean;
    isAuthenticating: boolean;
    /**
     * Authentication has succeeded but the guard has not opened yet — the store
     * is holding the success confirmation on screen for one beat.
     */
    isUnlocking?: boolean;
  },
): LockDecision {
  // Mid-authentication, the app is *expected* to lose the foreground: the platform
  // may put its PIN or pattern screen in front, which is a separate activity.
  // Reacting to that would cancel the unlock in progress, every time.
  if (context.isAuthenticating) return "ignore";

  if (next === "active") return "reveal";

  // The gap between a successful fingerprint and the notes appearing. Leaving the
  // foreground here has to lock, or the pending unlock would complete while the
  // app sat in the background and the notes would be waiting, open, on return.
  if (!context.isUnlocked && context.isUnlocking) {
    return next === "background" ? "lock" : "shield";
  }

  // Already locked: there is nothing on screen worth hiding, and locking again
  // would restart the unlock screen's own animations underneath the shield.
  if (!context.isUnlocked) return "ignore";

  switch (next) {
    case "background":
      return "lock";

    // iOS's transitional state: the notification shade, the app switcher, an
    // incoming call. Cover the notes immediately, because this is the moment a
    // screenshot for the app switcher is taken — but do not lock, because the app
    // may simply come straight back.
    case "inactive":
      return "shield";

    default:
      // Unknown states are treated as leaving the foreground. Guessing wrong this
      // way costs an unlock; guessing wrong the other way shows someone's notes.
      return "shield";
  }
}
