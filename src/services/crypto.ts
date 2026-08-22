/**
 * SHA-256, HMAC-SHA-256 and PBKDF2, in plain TypeScript.
 *
 * Hermes exposes no WebCrypto and the project has no crypto dependency, so a
 * passcode has nothing to be hashed with. This fills that gap and nothing more —
 * it is used only to derive the passcode verifier in `passcode-service`.
 *
 * Correctness is not taken on trust: the tests check these against Node's own
 * `node:crypto` over generated inputs, so a mistake in the compression function
 * or the padding shows up as a mismatch rather than as a subtly weak hash.
 *
 * It is not constant-time, and it is not fast. Neither matters for the one thing
 * it does: the input is a short passcode, the work factor is deliberate, and the
 * comparison of the result is done separately in constant time.
 */

/** First 32 bits of the fractional parts of the cube roots of the first 64 primes. */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1,
  0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786,
  0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
  0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a,
  0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const BLOCK_SIZE = 64;
const DIGEST_SIZE = 32;

const rotr = (value: number, bits: number) =>
  (value >>> bits) | (value << (32 - bits));

/** SHA-256 of a byte array. */
export function sha256(message: Uint8Array): Uint8Array {
  const state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c,
    0x1f83d9ab, 0x5be0cd19,
  ]);

  // Padding: a 1 bit, zeroes, then the length in bits as a 64-bit big-endian
  // integer, all rounded up to a whole number of blocks.
  const bitLength = message.length * 8;
  const padded = new Uint8Array(
    (Math.floor((message.length + 8) / BLOCK_SIZE) + 1) * BLOCK_SIZE,
  );

  padded.set(message);
  padded[message.length] = 0x80;

  // Lengths beyond 2^32 bits cannot occur here (the inputs are passcodes and
  // digests), so only the low word is written.
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 4, bitLength >>> 0, false);
  view.setUint32(padded.length - 8, Math.floor(bitLength / 2 ** 32), false);

  const w = new Uint32Array(64);

  for (let offset = 0; offset < padded.length; offset += BLOCK_SIZE) {
    for (let index = 0; index < 16; index++) {
      w[index] = view.getUint32(offset + index * 4, false);
    }

    for (let index = 16; index < 64; index++) {
      const s0 =
        rotr(w[index - 15], 7) ^ rotr(w[index - 15], 18) ^ (w[index - 15] >>> 3);
      const s1 =
        rotr(w[index - 2], 17) ^ rotr(w[index - 2], 19) ^ (w[index - 2] >>> 10);

      w[index] = (w[index - 16] + s0 + w[index - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = state;

    for (let index = 0; index < 64; index++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[index] + w[index]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    state[0] = (state[0] + a) >>> 0;
    state[1] = (state[1] + b) >>> 0;
    state[2] = (state[2] + c) >>> 0;
    state[3] = (state[3] + d) >>> 0;
    state[4] = (state[4] + e) >>> 0;
    state[5] = (state[5] + f) >>> 0;
    state[6] = (state[6] + g) >>> 0;
    state[7] = (state[7] + h) >>> 0;
  }

  const digest = new Uint8Array(DIGEST_SIZE);
  const out = new DataView(digest.buffer);

  for (let index = 0; index < 8; index++) {
    out.setUint32(index * 4, state[index], false);
  }

  return digest;
}

/** HMAC-SHA-256, as specified in RFC 2104. */
export function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  // Keys longer than the block size are hashed down; shorter ones are padded.
  const normalized = new Uint8Array(BLOCK_SIZE);
  normalized.set(key.length > BLOCK_SIZE ? sha256(key) : key);

  const inner = new Uint8Array(BLOCK_SIZE + message.length);
  const outer = new Uint8Array(BLOCK_SIZE + DIGEST_SIZE);

  for (let index = 0; index < BLOCK_SIZE; index++) {
    inner[index] = normalized[index] ^ 0x36;
    outer[index] = normalized[index] ^ 0x5c;
  }

  inner.set(message, BLOCK_SIZE);
  outer.set(sha256(inner), BLOCK_SIZE);

  return sha256(outer);
}

/** PBKDF2-HMAC-SHA-256, as specified in RFC 2898. */
export function pbkdf2Sha256(
  password: Uint8Array,
  salt: Uint8Array,
  iterations: number,
  length: number,
): Uint8Array {
  const output = new Uint8Array(length);
  const blocks = Math.ceil(length / DIGEST_SIZE);
  const counted = new Uint8Array(salt.length + 4);

  counted.set(salt);

  for (let block = 1; block <= blocks; block++) {
    // INT(i): the block index as a 32-bit big-endian integer.
    counted[salt.length] = (block >>> 24) & 0xff;
    counted[salt.length + 1] = (block >>> 16) & 0xff;
    counted[salt.length + 2] = (block >>> 8) & 0xff;
    counted[salt.length + 3] = block & 0xff;

    let u = hmacSha256(password, counted);
    const accumulated = u.slice();

    for (let round = 1; round < iterations; round++) {
      u = hmacSha256(password, u);

      for (let index = 0; index < DIGEST_SIZE; index++) {
        accumulated[index] ^= u[index];
      }
    }

    output.set(
      accumulated.subarray(0, Math.min(DIGEST_SIZE, length - (block - 1) * DIGEST_SIZE)),
      (block - 1) * DIGEST_SIZE,
    );
  }

  return output;
}

const HEX = "0123456789abcdef";

export function toHex(bytes: Uint8Array): string {
  let out = "";

  for (const byte of bytes) {
    out += HEX[byte >> 4] + HEX[byte & 15];
  }

  return out;
}

export function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);

  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
}

/**
 * UTF-8 encodes a string without TextEncoder, which Hermes does not ship.
 *
 * Handles the whole range including surrogate pairs: a passcode is digits today,
 * but this is also the path a passphrase would take, and silently mangling
 * non-ASCII input would make such a passcode unverifiable rather than merely odd.
 */
export function utf8(text: string): Uint8Array {
  const bytes: number[] = [];

  for (let index = 0; index < text.length; index++) {
    let code = text.codePointAt(index) as number;

    // A surrogate pair is one code point spanning two units.
    if (code > 0xffff) index++;

    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }

  return new Uint8Array(bytes);
}

/**
 * Compares two byte arrays without leaking where they first differ.
 *
 * The timing of a passcode check is not much of a channel — the attacker holds the
 * device and the stored value is a hash — but a comparison that exits early is
 * free to avoid, and this is the one place the codebase compares a secret.
 */
export function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;

  let difference = 0;

  for (let index = 0; index < a.length; index++) {
    difference |= a[index] ^ b[index];
  }

  return difference === 0;
}
