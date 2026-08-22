/**
 * Stand-in for expo-secure-store, backed by a plain Map.
 *
 * The real module hands values to the iOS keychain or Android keystore. Nothing
 * here pretends to be secure — the point is that tests can read back exactly what
 * the app stored, which is how "the passcode is never stored in plaintext" becomes
 * something that can actually be checked.
 */

const store = new Map();

export function __dump() {
  return new Map(store);
}

export function __reset() {
  store.clear();
}

export const WHEN_UNLOCKED_THIS_DEVICE_ONLY =
  "whenUnlockedThisDeviceOnly";

export async function getItemAsync(key) {
  return store.has(key) ? store.get(key) : null;
}

export async function setItemAsync(key, value) {
  if (typeof value !== "string") {
    throw new TypeError("SecureStore only stores strings");
  }

  store.set(key, value);
}

export async function deleteItemAsync(key) {
  store.delete(key);
}

export async function isAvailableAsync() {
  return true;
}
