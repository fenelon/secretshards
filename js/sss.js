/**
 * sss.js — Shamir's Secret Sharing core math utilities
 *
 * Port of lib/utils.rb. Attaches to window.SSS for file:// compatibility.
 * Requires a browser with BigInt and crypto.getRandomValues support.
 */
(function (global) {
  'use strict';

  // 2^256 - 189  (matches Ruby default prime)
  const PRIME = 2n ** 256n - 189n;

  /**
   * Returns a cryptographically random BigInt in [0, PRIME).
   */
  function random() {
    const bytes = new Uint8Array(32);
    let value;
    do {
      crypto.getRandomValues(bytes);
      let hex = '';
      for (let i = 0; i < bytes.length; i++) {
        hex += bytes[i].toString(16).padStart(2, '0');
      }
      value = BigInt('0x' + hex);
    } while (value >= PRIME);
    return value;
  }

  /**
   * Converts a UTF-8 string to an array of BigInts.
   *
   * Each character is hex-encoded, the hex string is split into 64-char chunks,
   * each chunk is RIGHT-padded with zeros to 64 chars, then parsed as a BigInt.
   * This matches Ruby: (segment + "0"*(64-segment.size)).hex
   */
  function splitInts(secret) {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(secret);

    // Convert each byte to a 2-char hex string, concatenate all
    let hexStr = '';
    for (let i = 0; i < bytes.length; i++) {
      hexStr += bytes[i].toString(16).padStart(2, '0');
    }

    // Split into 64-char chunks and right-pad each to 64 chars
    const result = [];
    for (let pos = 0; pos < hexStr.length; pos += 64) {
      const segment = hexStr.slice(pos, pos + 64);
      // Right-pad with zeros to reach 64 chars
      const padded = segment + '0'.repeat(64 - segment.length);
      result.push(BigInt('0x' + padded));
    }

    return result;
  }

  /**
   * Converts an array of BigInts back to a UTF-8 string.
   *
   * Each BigInt is left-padded to 64 hex chars, split into byte pairs,
   * parsed to bytes, trailing null bytes are trimmed, then decoded as UTF-8.
   * This matches Ruby: int.to_s(16) left-padded to 64, scan(/../) → bytes.
   */
  function mergeInts(secrets) {
    const byteArr = [];

    for (let i = 0; i < secrets.length; i++) {
      const hexStr = secrets[i].toString(16).padStart(64, '0');
      // Split into byte pairs (each 2 hex chars = 1 byte)
      for (let pos = 0; pos < hexStr.length; pos += 2) {
        byteArr.push(parseInt(hexStr.slice(pos, pos + 2), 16));
      }
    }

    // Trim trailing null bytes (matching Ruby's gsub(/\u0000*$/, ''))
    let end = byteArr.length;
    while (end > 0 && byteArr[end - 1] === 0) {
      end--;
    }

    const trimmed = new Uint8Array(byteArr.slice(0, end));
    const decoder = new TextDecoder('utf-8');
    return decoder.decode(trimmed);
  }

  /**
   * Evaluates a polynomial using Horner's method.
   *
   * Given coefficients [a, b, c] and value x, computes a + bx + cx^2 (mod PRIME).
   * Matches Ruby: iterate reverse, result = result*value + coefficient (mod prime).
   */
  function evaluatePolynomial(coefficients, value) {
    let result = 0n;
    for (let i = coefficients.length - 1; i >= 0; i--) {
      result = (result * value + coefficients[i]) % PRIME;
    }
    return result;
  }

  /**
   * Extended Euclidean algorithm.
   * Returns [gcd, x, y] such that gcd = a*x + b*y.
   *
   * Matches Ruby exactly:
   *   if b===0 return [a,1,0]
   *   else n=floor(a/b), c=a%b, r=gcd(b,c), return [r[0], r[2], r[1]-r[2]*n]
   */
  function gcd(a, b) {
    if (b === 0n) {
      return [a, 1n, 0n];
    } else {
      const n = a / b; // BigInt division truncates (floors for positive values)
      const c = a % b;
      const r = gcd(b, c);
      return [r[0], r[2], r[1] - r[2] * n];
    }
  }

  /**
   * Computes the multiplicative inverse of number in the prime field.
   *
   * Matches Ruby exactly:
   *   remainder = gcd(prime, number % prime)[2]
   *   if number < 0: remainder *= -1
   *   return (prime + remainder) % prime
   */
  function modInverse(number) {
    const num = BigInt(number);
    let remainder = gcd(PRIME, num % PRIME)[2];
    if (num < 0n) {
      remainder = remainder * -1n;
    }
    return (PRIME + remainder) % PRIME;
  }

  /**
   * Converts a BigInt to a 44-character URL-safe base64 string.
   *
   * Left-pads hex to 64 chars, converts to binary string, btoa encodes,
   * then substitutes + → - and / → _ (URL-safe alphabet, with = padding).
   * Matches Ruby: Base64.urlsafe_encode64(...)
   */
  function toBase64(number) {
    const num = BigInt(number);
    const hexStr = num.toString(16).padStart(64, '0');

    // Convert hex pairs to a binary string (each pair is one byte / char code)
    let binaryStr = '';
    for (let i = 0; i < hexStr.length; i += 2) {
      binaryStr += String.fromCharCode(parseInt(hexStr.slice(i, i + 2), 16));
    }

    // Standard base64, then make URL-safe
    const b64 = btoa(binaryStr);
    return b64.replace(/\+/g, '-').replace(/\//g, '_');
  }

  /**
   * Converts a 44-character URL-safe base64 string to a BigInt.
   *
   * Reverses URL-safe substitution, atob decodes, hex-encodes each char,
   * right-pads the resulting hex to 64 chars, then parses as BigInt.
   *
   * Matches Ruby:
   *   segment = decoded bytes as hex pairs
   *   (segment + ["00"]*(32-segment.size)).join.hex
   *
   * The right-padding ensures truncated base64 payloads (e.g. for small
   * numbers) are expanded back to their original 32-byte width.
   */
  function fromBase64(str) {
    // Restore standard base64 alphabet
    const standard = str.replace(/-/g, '+').replace(/_/g, '/');
    const binaryStr = atob(standard);

    // Hex-encode each character (byte)
    const hexPairs = [];
    for (let i = 0; i < binaryStr.length; i++) {
      hexPairs.push(binaryStr.charCodeAt(i).toString(16).padStart(2, '0'));
    }

    // Right-pad with "00" pairs to reach 32 bytes (64 hex chars)
    while (hexPairs.length < 32) {
      hexPairs.push('00');
    }

    return BigInt('0x' + hexPairs.join(''));
  }

  /**
   * Creates Shamir secret shares.
   *
   * @param {number} minimum  - Minimum shares needed to reconstruct the secret.
   * @param {number} total    - Total number of shares to generate.
   * @param {string} raw      - The secret string (UTF-8, max 512 bytes).
   * @returns {string[]}      - Array of `total` base64-encoded share strings.
   *
   * Each share is a concatenation of base64(x) + base64(y) pairs, one per
   * secret chunk (44 chars each), giving a total length of chunks * 88 chars.
   */
  function create(minimum, total, raw, options) {
    if (minimum < 2) {
      throw new Error('minimum must be >= 2');
    }
    if (total < minimum) {
      throw new Error('total must be >= minimum');
    }
    if (total > 255) {
      throw new Error('total must be <= 255');
    }
    const encoder = new TextEncoder();
    const byteLen = encoder.encode(raw).length;
    if (byteLen > 512) {
      throw new Error('secret exceeds 512 bytes');
    }

    // v2: prepend magic prefix for validation on combine
    const isV2 = options !== undefined;
    const secretToSplit = isV2 ? MAGIC_PREFIX + raw : raw;

    const secrets = splitInts(secretToSplit);
    const shares = [];

    // Pre-generate unique random x-values for each share
    const xValues = [];
    for (let s = 0; s < total; s++) {
      let x;
      do {
        x = random();
      } while (xValues.some(function (v) { return v === x; }));
      xValues.push(x);
    }

    // Build polynomial for each secret chunk and evaluate at each x
    for (let s = 0; s < total; s++) {
      shares.push('');
    }

    for (let i = 0; i < secrets.length; i++) {
      const coefficients = [secrets[i]];
      for (let k = 1; k < minimum; k++) {
        coefficients.push(random());
      }

      for (let s = 0; s < total; s++) {
        const y = evaluatePolynomial(coefficients, xValues[s]);
        shares[s] += toBase64(xValues[s]) + toBase64(y);
      }
    }

    // v2: prepend header to each share
    if (isV2) {
      const name = sanitizeName(options.name || '');
      const threshold = String(Math.min(minimum, 99)).padStart(2, '0');
      const header = '02:' + threshold + ':' + name + ':';
      for (let s = 0; s < total; s++) {
        shares[s] = header + shares[s];
      }
    }

    return shares;
  }

  /**
   * Combines Shamir secret shares to recover the original secret.
   *
   * @param {string[]} shares - Array of share strings (as produced by create).
   * @returns {string}        - The recovered secret string.
   *
   * Uses Lagrange interpolation over the prime field to recover each secret
   * chunk at x=0.
   */
  function combine(shares) {
    if (!Array.isArray(shares) || shares.length < 2) {
      throw new Error('at least 2 shares are required');
    }
    const expectedLen = shares[0].length;
    if (!expectedLen || expectedLen % 88 !== 0) {
      throw new Error('invalid share format');
    }
    for (let i = 1; i < shares.length; i++) {
      if (shares[i].length !== expectedLen) {
        throw new Error('all shares must be the same length');
      }
    }

    // Maps any BigInt to its canonical representative in [0, PRIME)
    function modPos(v) { return ((v % PRIME) + PRIME) % PRIME; }

    // Determine how many secret chunks each share encodes
    const count = expectedLen / 88;

    const secrets = [];
    for (let i = 0; i < count; i++) {
      // Parse x and y for each share for this chunk
      const points = [];
      for (let j = 0; j < shares.length; j++) {
        const xStr = shares[j].substring(i * 88, i * 88 + 44);
        const yStr = shares[j].substring(i * 88 + 44, i * 88 + 88);
        points.push([fromBase64(xStr), fromBase64(yStr)]);
      }

      // Lagrange interpolation at x=0
      let secret = 0n;
      for (let a = 0; a < points.length; a++) {
        let numerator = 1n;
        let denominator = 1n;
        for (let b = 0; b < points.length; b++) {
          if (a !== b) {
            numerator = modPos(numerator * modPos(0n - points[b][0]));
            denominator = modPos(denominator * modPos(points[a][0] - points[b][0]));
          }
        }
        // Compute contribution: y_a * numerator * modInverse(denominator)
        const contribution = modPos(points[a][1] * numerator * modInverse(denominator));
        secret = modPos(secret + contribution);
      }

      secrets.push(secret);
    }

    return mergeInts(secrets);
  }

  const MAGIC_PREFIX = 'SSS:';

  function sanitizeName(name) {
    if (!name) return '';
    return String(name).replace(/ /g, '_').substring(0, 20);
  }

  function parseShare(candidate) {
    if (!candidate || typeof candidate !== 'string') return null;

    if (/^\d{2}:/.test(candidate)) {
      const first = candidate.indexOf(':');
      const second = candidate.indexOf(':', first + 1);
      const third = candidate.indexOf(':', second + 1);
      if (first === -1 || second === -1 || third === -1) return null;

      const versionStr = candidate.substring(0, first);
      const thresholdStr = candidate.substring(first + 1, second);
      const name = candidate.substring(second + 1, third);
      const payload = candidate.substring(third + 1);

      if (!/^\d{2}$/.test(versionStr) || !/^\d{2}$/.test(thresholdStr)) return null;
      if (!payload || payload.length === 0 || payload.length % 88 !== 0) return null;
      if (!isValidSharePayload(payload)) return null;

      return {
        version: parseInt(versionStr, 10),
        threshold: parseInt(thresholdStr, 10),
        name: name.replace(/_/g, ' '),
        payload: payload,
      };
    }

    if (candidate.length > 0 && candidate.length % 88 === 0 && isValidSharePayload(candidate)) {
      return {
        version: 0,
        threshold: null,
        name: null,
        payload: candidate,
      };
    }

    return null;
  }

  function isValidSharePayload(payload) {
    if (!payload || payload.length === 0 || payload.length % 88 !== 0) return false;
    const count = payload.length / 88;
    for (let j = 0; j < count; j++) {
      const xStr = payload.substring(j * 88, j * 88 + 44);
      const yStr = payload.substring(j * 88 + 44, j * 88 + 88);
      try {
        const x = fromBase64(xStr);
        const y = fromBase64(yStr);
        if (x < 0n || x >= PRIME || y < 0n || y >= PRIME) return false;
      } catch (e) {
        return false;
      }
    }
    return true;
  }

  /**
   * Returns true if candidate is a syntactically valid share string.
   *
   * @param {string} candidate
   * @returns {boolean}
   */
  function isValidShare(candidate) {
    return parseShare(candidate) !== null;
  }

  /**
   * Returns a timestamped filename string: prefix + YYYYMMDD-HHMMSS + random.
   */
  function timestampedName(prefix) {
    const now = new Date();
    const ts = now.getFullYear()
      + String(now.getMonth() + 1).padStart(2, '0')
      + String(now.getDate()).padStart(2, '0')
      + '-' + String(now.getHours()).padStart(2, '0')
      + String(now.getMinutes()).padStart(2, '0')
      + String(now.getSeconds()).padStart(2, '0');
    const randBytes = new Uint8Array(4);
    crypto.getRandomValues(randBytes);
    let rand = '';
    for (let i = 0; i < randBytes.length; i++) {
      rand += randBytes[i].toString(36).padStart(2, '0');
    }
    return prefix + ts + '-' + rand;
  }

  // Attach to global namespace
  global.SSS = {
    _prime: PRIME,
    _magicPrefix: MAGIC_PREFIX,
    random: random,
    splitInts: splitInts,
    mergeInts: mergeInts,
    evaluatePolynomial: evaluatePolynomial,
    gcd: gcd,
    modInverse: modInverse,
    toBase64: toBase64,
    fromBase64: fromBase64,
    create: create,
    combine: combine,
    isValidShare: isValidShare,
    parseShare: parseShare,
    sanitizeName: sanitizeName,
    timestampedName: timestampedName,
  };
})(typeof window !== 'undefined' ? window : this);
