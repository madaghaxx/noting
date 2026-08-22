import * as SecureStore from "expo-secure-store";

import {
  equalBytes,
  fromHex,
  pbkdf2Sha256,
  toHex,
  utf8,
} from "./crypto";

/**
 * Noting's own passcode: an optional second way in, alongside biometrics.
 *
 * What is stored is a PBKDF2-HMAC-SHA256 verifier — a random salt, the iteration
 * count, and the derived key — and never the passcode. Recovering the code from
 * the record means running the derivation for every candidate, which the iteration
 * count is there to make expensive.
 *
 * The record lives in SecureStore (iOS keychain, Android keystore) rather than in
 * SQLite, so reading it needs more than a copy of the app's data directory. It is
 * marked as never leaving this device: a passcode restored onto different hardware
 * would be a way in that the person who set it did not agree to.
 *
 * The passcode is never written to a log, never held in state longer than the
 * check it is used for, and never included in an error message.
 */

const VERIFIER_KEY = "noting.passcode.verifier.v1";
const GUARD_KEY = "noting.passcode.guard.v1";

/**
 * Chosen against a measurement rather than a habit: ~150ms in V8 and under a
 * second on a phone's slower interpreter, which is the most that can be spent
 * while someone is waiting to get into their notes. Stored per record, so it can
 * be raised later without invalidating a passcode already set.
 */
const ITERATIONS = 25_000;

const SALT_BYTES = 16;
const KEY_BYTES = 32;

/** Long enough to be worth having, short enough to be worth typing. */
export const MIN_LENGTH = 4;
export const MAX_LENGTH = 8;

/** Failed attempts before the passcode goes quiet for a while. */
const ATTEMPT_LIMIT = 5;

/** And for how long, growing with each further group of failures. */
const COOLDOWNS = [30_000, 60_000, 300_000, 900_000];

type Verifier = {
  v: 1;
  salt: string;
  iterations: number;
  hash: string;
};

export type Guard = {
  failed: number;
  /** Epoch milliseconds until which the passcode will not be accepted. */
  lockedUntil: number;
};

const EMPTY_GUARD: Guard = { failed: 0, lockedUntil: 0 };

/**
 * Salt bytes.
 *
 * Uses the platform's generator when there is one. Hermes ships no WebCrypto and
 * the project has no crypto dependency, so the fallback mixes the clock, a counter
 * and `Math.random`.
 *
 * That fallback is not unpredictable, and it is not pretending to be. What a salt
 * has to be is *unique* — it exists so that one derivation cannot be reused
 * against another device, or against a table computed in advance — and uniqueness
 * is what the clock and counter provide. The secret here is the passcode; the salt
 * is not one.
 */
let saltCounter = 0;

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  const source = globalThis.crypto;

  if (source && typeof source.getRandomValues === "function") {
    source.getRandomValues(bytes);

    return bytes;
  }

  const seed = utf8(
    `${Date.now()}:${saltCounter++}:${Math.random()}:${Math.random()}`,
  );

  // Stretched through the same derivation so the output is spread evenly over the
  // byte range rather than carrying the shape of the string it came from.
  return pbkdf2Sha256(seed, utf8("noting.salt"), 1, length);
}

function isValidLength(code: string): boolean {
  // Counted in code points, not UTF-16 units, so a single emoji is one character
  // rather than two — otherwise the limit would depend on what was typed.
  const length = [...code].length;

  return length >= MIN_LENGTH && length <= MAX_LENGTH;
}

async function readVerifier(): Promise<Verifier | null> {
  const raw = await SecureStore.getItemAsync(VERIFIER_KEY);

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Verifier;

    // A record this app cannot understand is treated as no record at all rather
    // than as a reason to crash the unlock screen.
    if (parsed?.v !== 1 || !parsed.salt || !parsed.hash) return null;

    return parsed;
  } catch {
    return null;
  }
}

export async function hasPasscode(): Promise<boolean> {
  return (await readVerifier()) !== null;
}

/**
 * Sets or replaces the passcode.
 *
 * Throws on a code outside the allowed length: that is a programming error, since
 * the UI cannot submit one, and silently storing something unusable would be worse
 * than failing loudly. The message never contains the code.
 */
export async function setPasscode(code: string): Promise<void> {
  if (!isValidLength(code)) {
    throw new Error(
      `A passcode must be between ${MIN_LENGTH} and ${MAX_LENGTH} characters.`,
    );
  }

  const salt = randomBytes(SALT_BYTES);
  const hash = pbkdf2Sha256(utf8(code), salt, ITERATIONS, KEY_BYTES);

  const record: Verifier = {
    v: 1,
    salt: toHex(salt),
    iterations: ITERATIONS,
    hash: toHex(hash),
  };

  await SecureStore.setItemAsync(VERIFIER_KEY, JSON.stringify(record), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });

  // A new passcode starts with a clean slate; the old code's failures are not
  // this one's problem.
  await clearGuard();
}

/**
 * Checks a passcode. Returns false when none is set — there is nothing to match,
 * and answering "true" would turn an unset passcode into an open door.
 */
export async function verifyPasscode(code: string): Promise<boolean> {
  const record = await readVerifier();

  if (!record) return false;
  if (!isValidLength(code)) return false;

  const derived = pbkdf2Sha256(
    utf8(code),
    fromHex(record.salt),
    record.iterations,
    fromHex(record.hash).length,
  );

  return equalBytes(derived, fromHex(record.hash));
}

export async function clearPasscode(): Promise<void> {
  await SecureStore.deleteItemAsync(VERIFIER_KEY);
  await clearGuard();
}

export async function readGuard(): Promise<Guard> {
  const raw = await SecureStore.getItemAsync(GUARD_KEY);

  if (!raw) return EMPTY_GUARD;

  try {
    const parsed = JSON.parse(raw) as Guard;

    return {
      failed: Number(parsed?.failed) || 0,
      lockedUntil: Number(parsed?.lockedUntil) || 0,
    };
  } catch {
    return EMPTY_GUARD;
  }
}

/**
 * Records a wrong passcode and returns the resulting guard.
 *
 * Persisted rather than counted in memory: an attempt counter that resets when the
 * app restarts is not a limit, it is a formality.
 */
export async function noteFailure(now: number): Promise<Guard> {
  const previous = await readGuard();
  const failed = previous.failed + 1;

  const groups = Math.floor(failed / ATTEMPT_LIMIT);

  const guard: Guard = {
    failed,
    lockedUntil:
      failed % ATTEMPT_LIMIT === 0
        ? now + COOLDOWNS[Math.min(groups - 1, COOLDOWNS.length - 1)]
        : previous.lockedUntil,
  };

  await SecureStore.setItemAsync(GUARD_KEY, JSON.stringify(guard));

  return guard;
}

export async function clearGuard(): Promise<void> {
  await SecureStore.deleteItemAsync(GUARD_KEY);
}

/** Milliseconds left before the passcode will be accepted again. */
export function remainingLockout(guard: Guard, now: number): number {
  return Math.max(0, guard.lockedUntil - now);
}

/** Attempts left before the next cooldown. */
export function attemptsRemaining(guard: Guard): number {
  return ATTEMPT_LIMIT - (guard.failed % ATTEMPT_LIMIT);
}
