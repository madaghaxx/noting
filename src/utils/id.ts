/**
 * Generates an id for a locally created note.
 *
 * Deliberately not a security primitive: note ids are never secret and are
 * never used for authorization, so `Math.random` is adequate here. The
 * timestamp prefix keeps ids roughly ordered by creation and makes a collision
 * within a single device implausible.
 *
 * Swap the body for `Crypto.randomUUID()` once `expo-crypto` is installed — the
 * indirection exists so that stays a one-line change.
 */
export function createId(): string {
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);

  return `${time}-${random}`;
}
