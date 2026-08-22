/**
 * SHA-256, HMAC and PBKDF2, checked against Node's own crypto.
 *
 * This is the highest-value suite in the project: the code under test is a hash
 * function written from the specification, and a mistake in it would not look like
 * a bug — it would look like a working app whose passcode verifier is weak. Rather
 * than trust a handful of published vectors, every case is compared with
 * `node:crypto` over generated inputs, including the awkward lengths around the
 * padding boundary.
 */
import assert from "node:assert/strict";
import { createHash, createHmac, pbkdf2Sync } from "node:crypto";
import test from "node:test";

import {
  equalBytes,
  fromHex,
  hmacSha256,
  pbkdf2Sha256,
  sha256,
  toHex,
  utf8,
} from "@/src/services/crypto";

const nodeSha = (bytes) =>
  createHash("sha256").update(Buffer.from(bytes)).digest("hex");

const nodeHmac = (key, message) =>
  createHmac("sha256", Buffer.from(key)).update(Buffer.from(message)).digest("hex");

/** Deterministic pseudo-random bytes, so a failure is always reproducible. */
function bytes(length, seed = 1) {
  const out = new Uint8Array(length);
  let state = seed;

  for (let index = 0; index < length; index++) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    out[index] = (state >>> 16) & 0xff;
  }

  return out;
}

test("sha256 matches the published vectors", () => {
  assert.equal(
    toHex(sha256(utf8(""))),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );

  assert.equal(
    toHex(sha256(utf8("abc"))),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );

  assert.equal(
    toHex(
      sha256(
        utf8(
          "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq",
        ),
      ),
    ),
    "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
  );
});

test("sha256 matches node at every length across the padding boundary", () => {
  // 55/56 and 63/64 are where the length field stops fitting in the final block
  // and an extra block appears — the classic place a hand-written SHA-256 breaks.
  for (const length of [
    0, 1, 2, 3, 54, 55, 56, 57, 63, 64, 65, 100, 119, 120, 127, 128, 129, 1000,
  ]) {
    const input = bytes(length, length + 7);

    assert.equal(
      toHex(sha256(input)),
      nodeSha(input),
      `sha256 diverged at ${length} bytes`,
    );
  }
});

test("sha256 matches node on generated inputs", () => {
  for (let seed = 1; seed <= 60; seed++) {
    const input = bytes(seed * 3, seed);

    assert.equal(toHex(sha256(input)), nodeSha(input), `seed ${seed}`);
  }
});

test("sha256 handles every byte value", () => {
  const all = new Uint8Array(256);

  for (let index = 0; index < 256; index++) all[index] = index;

  assert.equal(toHex(sha256(all)), nodeSha(all));
});

test("hmac matches node, including keys longer than the block size", () => {
  const cases = [
    [utf8(""), utf8("")],
    [utf8("key"), utf8("The quick brown fox jumps over the lazy dog")],
    [bytes(31, 2), bytes(80, 3)],
    [bytes(64, 4), bytes(1, 5)],
    // A key longer than 64 bytes has to be hashed down first.
    [bytes(65, 6), bytes(40, 7)],
    [bytes(200, 8), bytes(200, 9)],
  ];

  for (const [key, message] of cases) {
    assert.equal(
      toHex(hmacSha256(key, message)),
      nodeHmac(key, message),
      `hmac diverged for a ${key.length}-byte key`,
    );
  }
});

test("pbkdf2 matches node", () => {
  const cases = [
    ["password", "salt", 1, 32],
    ["password", "salt", 2, 32],
    ["password", "salt", 4096, 32],
    ["passwd", "salt", 1, 64],
    // More than one output block, so the block counter is exercised.
    ["short", "pepper", 10, 100],
    ["1234", "0123456789abcdef", 1000, 32],
  ];

  for (const [password, salt, iterations, length] of cases) {
    const mine = pbkdf2Sha256(
      utf8(password),
      utf8(salt),
      iterations,
      length,
    );

    const theirs = pbkdf2Sync(password, salt, iterations, length, "sha256");

    assert.equal(
      toHex(mine),
      theirs.toString("hex"),
      `pbkdf2 diverged for ${iterations} iterations, ${length} bytes`,
    );
  }
});

test("utf8 encodes what Node's Buffer encodes", () => {
  for (const text of [
    "",
    "1234",
    "passcode",
    "café",
    "日本語のメモ",
    "emoji 🔐 and 🧷",
    "surrogate pair: 𝔘",
    "mixed: a£日𝔘",
  ]) {
    assert.deepEqual(
      Array.from(utf8(text)),
      Array.from(Buffer.from(text, "utf8")),
      `utf8 diverged for ${JSON.stringify(text)}`,
    );
  }
});

test("hex round-trips", () => {
  const input = bytes(64, 11);

  assert.deepEqual(Array.from(fromHex(toHex(input))), Array.from(input));
  assert.equal(toHex(new Uint8Array([0, 15, 16, 255])), "000f10ff");
});

test("equalBytes is exact", () => {
  assert.ok(equalBytes(bytes(32, 1), bytes(32, 1)));
  assert.ok(!equalBytes(bytes(32, 1), bytes(32, 2)));
  assert.ok(!equalBytes(bytes(32, 1), bytes(31, 1)));

  // Differing only in the last byte must fail as surely as the first.
  const a = bytes(32, 3);
  const b = a.slice();
  b[31] ^= 1;

  assert.ok(!equalBytes(a, b));

  const c = a.slice();
  c[0] ^= 1;

  assert.ok(!equalBytes(a, c));
});

test("a realistic derivation is not so slow that it blocks the unlock screen", () => {
  // The work factor is deliberate, but it still has to finish while someone is
  // looking at a screen. This is a rough ceiling, not a benchmark.
  const started = process.hrtime.bigint();

  pbkdf2Sha256(utf8("1234"), bytes(16, 12), 20_000, 32);

  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;

  assert.ok(
    elapsedMs < 4000,
    `20k iterations took ${Math.round(elapsedMs)}ms in Node`,
  );
});
