import * as LocalAuthentication from "expo-local-authentication";

import type { IconName } from "@/src/components/ui/Icon";

export type BiometricKind = "fingerprint" | "face" | "iris";

/**
 * Which platform's vocabulary to use. Passed in rather than read from
 * `Platform.OS` so this module stays free of React Native and can be tested for
 * both platforms at once.
 */
export type OS = "ios" | "android" | string;

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

/**
 * Which modality the app names when a device offers several.
 *
 * Face first, then fingerprint, then iris.
 *
 * Worth being clear about what this does and does not control: on a device with
 * more than one sensor the *platform* decides which one its prompt uses, and no
 * app can override that. So this picks which one to name — and naming the one the
 * device leads with is what makes the screen match what then happens. On iOS the
 * question never arises, since a device has Face ID or Touch ID, never both.
 */
export function pickPrimary(kinds: BiometricKind[]): BiometricKind | null {
  const order: BiometricKind[] = ["face", "fingerprint", "iris"];

  return order.find((kind) => kinds.includes(kind)) ?? null;
}

/**
 * How to refer to a modality in user-facing copy.
 *
 * Platform-specific because these are proper nouns on iOS and plain descriptions
 * on Android: "Face ID" is a feature name, "face unlock" is a thing the phone does.
 * Getting this wrong is the kind of detail that makes an app feel foreign.
 */
export function describeMethod(kind: BiometricKind | null, os: OS): string {
  const isApple = os === "ios";

  switch (kind) {
    case "fingerprint":
      return isApple ? "Touch ID" : "fingerprint";
    case "face":
      return isApple ? "Face ID" : "face unlock";
    case "iris":
      return "iris";
    default:
      return "biometrics";
  }
}

/** The icon that stands for a modality. */
export function methodIcon(kind: BiometricKind | null): IconName {
  switch (kind) {
    case "face":
      return "face";
    case "fingerprint":
    case "iris":
      return "fingerprint";
    default:
      return "lock";
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
    primary: pickPrimary(kinds),
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
 * Opens the platform's biometric prompt.
 *
 * `disableDeviceFallback: false` leaves the device's own PIN or pattern available
 * inside the system prompt. Noting's passcode is a separate, app-level path — see
 * `passcode-service` — and having both is deliberate: the app one works when
 * biometrics are locked out, and the platform one works when the app's passcode
 * has been forgotten but the phone's has not.
 *
 * @param method  Named in the prompt so the sentence matches the sensor the device
 *                is about to use ("Confirm with Face ID").
 */
export async function authenticate(
  method?: BiometricKind | null,
  os: OS = "android",
): Promise<AuthOutcome> {
  const named = describeMethod(method ?? null, os);

  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: "Unlock Noting",
    promptSubtitle:
      method === null || method === undefined
        ? "Confirm it’s you to open your notes"
        : `Confirm with ${named} to open your notes`,
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
