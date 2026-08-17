import * as LocalAuthentication from "expo-local-authentication";

export type BiometricKind = "fingerprint" | "face" | "iris";

export type Capability = {
  hasHardware: boolean;
  isEnrolled: boolean;
  kinds: BiometricKind[];
  /** The modality to name in UI copy, when there is one. */
  primary: BiometricKind | null;
  /** A PIN, pattern or password is set, so credential fallback can succeed. */
  hasDeviceCredential: boolean;
};

/**
 * Every way authentication can end, reduced to the cases the UI actually
 * distinguishes. The native layer reports fourteen error strings; most of them
 * mean the same thing to a person.
 */
export type AuthOutcome =
  | { kind: "success" }
  | { kind: "cancelled" }
  | { kind: "failed"; message: string }
  | { kind: "lockedOut"; permanent: boolean }
  | { kind: "notEnrolled" }
  | { kind: "unavailable" }
  | { kind: "noDeviceCredential" };

function toKind(
  type: LocalAuthentication.AuthenticationType,
): BiometricKind | null {
  switch (type) {
    case LocalAuthentication.AuthenticationType.FINGERPRINT:
      return "fingerprint";
    case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
      return "face";
    case LocalAuthentication.AuthenticationType.IRIS:
      return "iris";
    default:
      return null;
  }
}

/** How to refer to a modality in user-facing copy. */
export function describeKind(kind: BiometricKind | null): string {
  switch (kind) {
    case "fingerprint":
      return "fingerprint";
    case "face":
      return "face";
    case "iris":
      return "iris";
    default:
      return "biometrics";
  }
}

export async function probeCapability(): Promise<Capability> {
  const [hasHardware, isEnrolled, types, level] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(),
    LocalAuthentication.getEnrolledLevelAsync(),
  ]);

  const kinds = types
    .map(toKind)
    .filter((kind): kind is BiometricKind => kind !== null);

  return {
    hasHardware,
    isEnrolled,
    kinds,
    // Fingerprint first when a device offers several: it is the fastest and the
    // one users expect on Android.
    primary:
      kinds.find((kind) => kind === "fingerprint") ?? kinds[0] ?? null,
    hasDeviceCredential: level !== LocalAuthentication.SecurityLevel.NONE,
  };
}

/**
 * Maps a native error string to an outcome.
 *
 * Expo documents the fourteen possible values but not their meanings, so
 * anything unrecognised falls through to a generic failure rather than being
 * assumed benign.
 */
function mapError(error: string): AuthOutcome {
  switch (error) {
    case "user_cancel":
    case "system_cancel":
    case "app_cancel":
      return { kind: "cancelled" };

    // The user picked the prompt's own device-credential button. The platform
    // takes over from there, so there is nothing for the app to route to —
    // whatever happens next arrives as its own result.
    case "user_fallback":
      return { kind: "cancelled" };

    case "not_enrolled":
      return { kind: "notEnrolled" };

    case "not_available":
    case "invalid_context":
      return { kind: "unavailable" };

    case "passcode_not_set":
      return { kind: "noDeviceCredential" };

    case "lockout":
      return { kind: "lockedOut", permanent: false };

    // Undocumented but emitted by the Android layer after repeated lockouts.
    case "lockout_permanent":
      return { kind: "lockedOut", permanent: true };

    case "authentication_failed":
      return { kind: "failed", message: "That didn’t match. Try again." };

    case "unable_to_process":
      return {
        kind: "failed",
        message: "The sensor couldn’t read that. Try again.",
      };

    case "timeout":
      return { kind: "failed", message: "The prompt timed out." };

    case "no_space":
      return {
        kind: "failed",
        message: "Not enough storage to complete authentication.",
      };

    default:
      return {
        kind: "failed",
        message: "Authentication couldn’t be completed.",
      };
  }
}

/**
 * Opens the biometric prompt.
 *
 * There is exactly one authentication path in Noting — both the primary unlock
 * action and the "Use passcode" action land here. The app deliberately has no
 * passcode UI of its own: `disableDeviceFallback: false` leaves the device
 * credential available as the platform's own fallback *inside* the system
 * prompt, which is the only place it belongs.
 */
export async function authenticate(): Promise<AuthOutcome> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Unlock Noting",
    promptSubtitle: "Confirm it’s you to open your notes",
    cancelLabel: "Cancel",
    disableDeviceFallback: false,
    // Class 3 biometrics only. The default ('weak') also admits 2D camera face
    // unlock, which is not a credential a private notebook should accept.
    biometricsSecurityLevel: "strong",
  });

  if (result.success) {
    return { kind: "success" };
  }

  return mapError(result.error);
}

/**
 * Dismisses a prompt the app itself opened. Android-only in Expo, and a no-op
 * elsewhere — used when the screen goes away mid-authentication.
 */
export async function cancelPending(): Promise<void> {
  try {
    await LocalAuthentication.cancelAuthenticate();
  } catch {
    // Nothing to cancel, or the platform doesn't support it. Not worth
    // surfacing — this only ever runs during teardown.
  }
}
