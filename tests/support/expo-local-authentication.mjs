/**
 * Stand-in for expo-local-authentication.
 *
 * The enums mirror the real module's numeric values, because the app maps over
 * them; everything else is driven by `setDevice`, so a test can describe a phone
 * ("Face ID, enrolled, no passcode set") and check what the app makes of it.
 */

export const AuthenticationType = {
  FINGERPRINT: 1,
  FACIAL_RECOGNITION: 2,
  IRIS: 3,
};

export const SecurityLevel = {
  NONE: 0,
  SECRET: 1,
  BIOMETRIC_WEAK: 2,
  BIOMETRIC_STRONG: 3,
};

const DEFAULTS = {
  hasHardware: true,
  isEnrolled: true,
  types: [AuthenticationType.FINGERPRINT],
  level: SecurityLevel.BIOMETRIC_STRONG,
  /** What the next authenticate() call resolves to. */
  result: { success: true },
  /** Every authenticate() call, so tests can assert what was asked for. */
  calls: [],
  cancelled: 0,
};

let device = { ...DEFAULTS };

/** Describes the device under test. Merged over the current description. */
export function setDevice(patch) {
  device = { ...device, ...patch };
}

export function resetDevice() {
  device = { ...DEFAULTS, types: [...DEFAULTS.types], calls: [] };
}

export function deviceCalls() {
  return device.calls;
}

export async function hasHardwareAsync() {
  if (device.throwOnProbe) throw new Error("probe failed");

  return device.hasHardware;
}

export async function isEnrolledAsync() {
  return device.isEnrolled;
}

export async function supportedAuthenticationTypesAsync() {
  return device.types;
}

export async function getEnrolledLevelAsync() {
  return device.level;
}

export async function authenticateAsync(options) {
  device.calls.push(options);

  return device.result;
}

export async function cancelAuthenticate() {
  device.cancelled += 1;
}
