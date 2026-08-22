/**
 * The passcode: what gets stored, what gets accepted, and what happens after
 * repeated wrong guesses.
 *
 * The stand-in for SecureStore keeps its contents inspectable, which is the only
 * way to check the claim that matters — that the passcode itself is never written
 * anywhere.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  attemptsRemaining,
  clearGuard,
  clearPasscode,
  hasPasscode,
  MAX_LENGTH,
  MIN_LENGTH,
  noteFailure,
  readGuard,
  remainingLockout,
  setPasscode,
  verifyPasscode,
} from "@/src/services/passcode-service";

import { __dump, __reset } from "./support/expo-secure-store.mjs";

/** Everything the app has written to secure storage, as one string. */
const stored = () => JSON.stringify(Array.from(__dump().entries()));

test("no passcode is set to begin with", async () => {
  assert.equal(await hasPasscode(), false);

  // And nothing verifies against a passcode that does not exist.
  assert.equal(await verifyPasscode("1234"), false);
});

test("a passcode can be set and verified", async () => {
  await setPasscode("1234");

  assert.equal(await hasPasscode(), true);
  assert.equal(await verifyPasscode("1234"), true);
});

test("the wrong passcode is refused", async () => {
  assert.equal(await verifyPasscode("4321"), false);
  assert.equal(await verifyPasscode("12345"), false);
  assert.equal(await verifyPasscode("123"), false);
  assert.equal(await verifyPasscode(""), false);
});

test("the passcode itself is never stored", async () => {
  await setPasscode("9182");

  const raw = stored();

  assert.ok(!raw.includes("9182"), "the passcode appears in secure storage");

  // Nor any obvious encoding of it.
  assert.ok(!raw.includes(Buffer.from("9182").toString("base64")));
  assert.ok(!raw.includes(Buffer.from("9182").toString("hex")));
});

test("what is stored is a salted verifier with its work factor", async () => {
  await setPasscode("2468");

  const record = JSON.parse(__dump().get("noting.passcode.verifier.v1"));

  assert.equal(record.v, 1);
  assert.equal(typeof record.salt, "string");
  assert.equal(record.salt.length, 32, "expected 16 salt bytes as hex");
  assert.equal(typeof record.hash, "string");
  assert.equal(record.hash.length, 64, "expected a 32-byte derived key as hex");
  assert.ok(record.iterations >= 10_000, "work factor is too low to matter");
});

test("the same passcode set twice produces different stored bytes", async () => {
  await setPasscode("1111");
  const first = __dump().get("noting.passcode.verifier.v1");

  await setPasscode("1111");
  const second = __dump().get("noting.passcode.verifier.v1");

  assert.notEqual(first, second, "the salt is not doing its job");

  // Both still verify: the salt changes the stored bytes, not the answer.
  assert.equal(await verifyPasscode("1111"), true);
});

test("changing the passcode replaces the old one", async () => {
  await setPasscode("1234");
  await setPasscode("5678");

  assert.equal(await verifyPasscode("5678"), true);
  assert.equal(await verifyPasscode("1234"), false);
});

test("clearing removes the passcode entirely", async () => {
  await setPasscode("1234");
  await clearPasscode();

  assert.equal(await hasPasscode(), false);
  assert.equal(await verifyPasscode("1234"), false);
  assert.equal(stored().includes("verifier"), false);
});

test("length limits are enforced where they are set, not just in the UI", async () => {
  await assert.rejects(() => setPasscode("123"), /passcode must be/);
  await assert.rejects(() => setPasscode("1".repeat(MAX_LENGTH + 1)), /passcode must be/);

  // The boundaries themselves are allowed.
  await setPasscode("1".repeat(MIN_LENGTH));
  assert.equal(await verifyPasscode("1".repeat(MIN_LENGTH)), true);

  await setPasscode("1".repeat(MAX_LENGTH));
  assert.equal(await verifyPasscode("1".repeat(MAX_LENGTH)), true);
});

test("an error about a bad passcode does not quote it", async () => {
  await assert.rejects(
    () => setPasscode("77"),
    (error) => {
      assert.ok(!error.message.includes("77"), "the message leaks the passcode");
      return true;
    },
  );
});

test("a non-numeric passcode works too", async () => {
  // The keypad types digits, but nothing below it assumes that — so a future
  // passphrase field would not need a different verifier.
  await setPasscode("op-en");

  assert.equal(await verifyPasscode("op-en"), true);
  assert.equal(await verifyPasscode("op-e"), false);
});

test("length is counted in characters, not UTF-16 units", async () => {
  // Four emoji are four characters. Counting code units would make this eight and
  // reject it, which would be a limit that depends on what was typed.
  await setPasscode("🔐🔐🔐🔐");

  assert.equal(await verifyPasscode("🔐🔐🔐🔐"), true);
});

test("a passcode with characters outside ASCII round-trips", async () => {
  await setPasscode("메모장🔐");

  assert.equal(await verifyPasscode("메모장🔐"), true);
  assert.equal(await verifyPasscode("메모장"), false);
});

test("a corrupt record fails closed instead of throwing", async () => {
  const { setItemAsync } = await import("./support/expo-secure-store.mjs");

  await setItemAsync("noting.passcode.verifier.v1", "not json at all");

  assert.equal(await hasPasscode(), false);
  assert.equal(await verifyPasscode("1234"), false);

  await setItemAsync(
    "noting.passcode.verifier.v1",
    JSON.stringify({ v: 99, salt: "aa", hash: "bb" }),
  );

  assert.equal(await hasPasscode(), false, "a future record was trusted");
  assert.equal(await verifyPasscode("1234"), false);
});

test("failed attempts are counted, and persist", async () => {
  __reset();
  await setPasscode("1234");

  assert.equal((await readGuard()).failed, 0);
  assert.equal(attemptsRemaining(await readGuard()), 5);

  await noteFailure(1000);
  await noteFailure(1000);

  const guard = await readGuard();

  assert.equal(guard.failed, 2);
  assert.equal(attemptsRemaining(guard), 3);
  assert.equal(remainingLockout(guard, 1000), 0, "locked out too early");
});

test("the fifth failure starts a cooldown", async () => {
  const now = 10_000;

  await noteFailure(now);
  await noteFailure(now);
  const guard = await noteFailure(now);

  assert.equal(guard.failed, 5);
  assert.ok(remainingLockout(guard, now) > 0, "no cooldown after five failures");
  assert.equal(remainingLockout(guard, now), 30_000);

  // It expires on its own.
  assert.equal(remainingLockout(guard, now + 30_000), 0);
  assert.equal(remainingLockout(guard, now + 60_000), 0);
});

test("each further group of failures waits longer", async () => {
  const now = 100_000;
  const waits = [];

  // Five more failures, five at a time, reading the cooldown each time it trips.
  for (let round = 0; round < 3; round++) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const guard = await noteFailure(now);

      if (guard.failed % 5 === 0) waits.push(remainingLockout(guard, now));
    }
  }

  assert.deepEqual(waits, [60_000, 300_000, 900_000]);
});

test("the right passcode is still the right passcode after failures", async () => {
  // The guard is advice for the screen, not part of the check: verification stays
  // a pure question about the code, so a lockout can never corrupt the verifier.
  assert.equal(await verifyPasscode("1234"), true);
});

test("clearing the guard resets the count", async () => {
  await clearGuard();

  const guard = await readGuard();

  assert.equal(guard.failed, 0);
  assert.equal(remainingLockout(guard, Date.now()), 0);
});

test("setting a new passcode clears the failure history", async () => {
  await noteFailure(1);
  await noteFailure(1);

  await setPasscode("4321");

  assert.equal((await readGuard()).failed, 0);
});
