/**
 * Vitest tests for sss.js — Shamir's Secret Sharing core math.
 *
 * Runs in Node with minimal shims for browser globals.
 */
import { describe, it, expect } from 'bun:test';
import { webcrypto } from 'node:crypto';
import { TextEncoder, TextDecoder } from 'node:util';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInThisContext } from 'node:vm';

// Shim browser globals that sss.js expects
globalThis.crypto = webcrypto;
globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder;
globalThis.btoa = (s) => Buffer.from(s, 'binary').toString('base64');
globalThis.atob = (s) => Buffer.from(s, 'base64').toString('binary');
globalThis.window = globalThis;

// Load sss.js (IIFE that attaches to window.SSS)
const sssPath = resolve(__dirname, '..', 'js', 'sss.js');
runInThisContext(readFileSync(sssPath, 'utf-8'), { filename: sssPath });

const SSS = globalThis.SSS;
const PRIME = SSS._prime;

// ---------------------------------------------------------------------------
// toBase64 / fromBase64
// ---------------------------------------------------------------------------
describe('toBase64 / fromBase64', () => {
  const cases = [0n, 1n, 255n, 2n ** 128n, PRIME - 1n];

  it.each(cases)('round-trips %s', (v) => {
    const encoded = SSS.toBase64(v);
    expect(encoded).toHaveLength(44);
    expect(SSS.fromBase64(encoded)).toBe(v);
  });
});

// ---------------------------------------------------------------------------
// splitInts / mergeInts
// ---------------------------------------------------------------------------
describe('splitInts / mergeInts', () => {
  const cases = ['hello', 'a', 'x'.repeat(64)];

  it.each(cases)('round-trips "%s"', (s) => {
    const chunks = SSS.splitInts(s);
    expect(chunks.length).toBeGreaterThan(0);
    expect(SSS.mergeInts(chunks)).toBe(s);
  });
});

// ---------------------------------------------------------------------------
// evaluatePolynomial
// ---------------------------------------------------------------------------
describe('evaluatePolynomial', () => {
  it('computes f(x)=3+2x+x² at x=2 as 11', () => {
    expect(SSS.evaluatePolynomial([3n, 2n, 1n], 2n)).toBe(11n);
  });
});

// ---------------------------------------------------------------------------
// modInverse
// ---------------------------------------------------------------------------
describe('modInverse', () => {
  const cases = [1n, 2n, 12345n, PRIME - 1n];

  it.each(cases)('(v * modInverse(v)) %% prime === 1 for v=%s', (v) => {
    const inv = SSS.modInverse(v);
    expect((v * inv) % PRIME).toBe(1n);
  });
});

// ---------------------------------------------------------------------------
// random
// ---------------------------------------------------------------------------
describe('random', () => {
  it('produces values in [0, PRIME)', () => {
    const r = SSS.random();
    expect(r).toBeGreaterThanOrEqual(0n);
    expect(r).toBeLessThan(PRIME);
  });

  it('produces different values on successive calls', () => {
    const r1 = SSS.random();
    const r2 = SSS.random();
    expect(r1).not.toBe(r2);
  });
});

// ---------------------------------------------------------------------------
// create + combine round-trip
// ---------------------------------------------------------------------------
describe('create + combine round-trip', () => {
  const cases = [
    { secret: 'hello world', minimum: 2, total: 3 },
    { secret: 'N17FigASkL6p1EOgJhRaIquQLGvYV0', minimum: 4, total: 5 },
    { secret: '0y10VAfmyH7GLQY6QccCSLKJi8iFgpcSBTLyYOGbiYPqOpStAf1OYuzEBzZR', minimum: 3, total: 6 },
  ];

  it.each(cases)('recovers "$secret" with min=$minimum of total=$total', (tc) => {
    const shares = SSS.create(tc.minimum, tc.total, tc.secret);
    expect(shares).toHaveLength(tc.total);
    const recovered = SSS.combine(shares.slice(0, tc.minimum));
    expect(recovered).toBe(tc.secret);
  });
});

// ---------------------------------------------------------------------------
// Ruby CLI cross-compatibility
// ---------------------------------------------------------------------------
describe('Ruby CLI cross-compatibility', () => {
  const rubyShares = [
    'bxJfjy0WZlJiTSgUStjCdaZ2z4vTLDP9T2Jma-GHSUQ=NINiBy3SjCcwQgOrLPMm0121vncBV8GT1jCeQwpuM78=',
    'U-gjIfmgANme26985FLzut_KCyi9kzvrSjrFIlOcRUA=mrBQRUX4CRk8gSISWk2wOzWu_JKgXUTjJGOhEQ5orIU=',
    'JqX7ufXkRusNtPqs5CCPvGwEwmVHRkLiuzRap4iKyUU=kCcRu4f3SQ7NpOYt9wjwPAfJN_rpSBzFfl9UPRoQwFM=',
  ];

  it('combines Ruby-generated shares to "test-pass"', () => {
    expect(SSS.combine(rubyShares)).toBe('test-pass');
  });
});

// ---------------------------------------------------------------------------
// create() validation
// ---------------------------------------------------------------------------
describe('create() validation', () => {
  it('throws for minimum < 2', () => {
    expect(() => SSS.create(1, 3, 'test')).toThrow('minimum must be >= 2');
  });

  it('throws for total < minimum', () => {
    expect(() => SSS.create(5, 3, 'test')).toThrow('total must be >= minimum');
  });

  it('throws for total > 255', () => {
    expect(() => SSS.create(2, 256, 'test')).toThrow('total must be <= 255');
  });

  it('throws for secret > 512 bytes', () => {
    expect(() => SSS.create(2, 3, 'x'.repeat(513))).toThrow('secret exceeds 512 bytes');
  });

  it('succeeds for exactly 512-byte secret', () => {
    expect(() => SSS.create(2, 3, 'x'.repeat(512))).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// combine() validation
// ---------------------------------------------------------------------------
describe('combine() validation', () => {
  it('throws for empty array', () => {
    expect(() => SSS.combine([])).toThrow('at least 2 shares are required');
  });

  it('throws for single share', () => {
    const shares = SSS.create(2, 2, 'test');
    expect(() => SSS.combine([shares[0]])).toThrow('at least 2 shares are required');
  });

  it('throws for mismatched share lengths', () => {
    const short = SSS.create(2, 2, 'ab');
    const long = SSS.create(2, 2, 'x'.repeat(64));
    expect(() => SSS.combine([short[0], long[0]])).toThrow('all shares must be the same length');
  });

  it('does not recover secret with fewer than minimum shares', () => {
    const shares = SSS.create(3, 5, 'correct secret');
    const recovered = SSS.combine(shares.slice(0, 2));
    expect(recovered).not.toBe('correct secret');
  });
});

// ---------------------------------------------------------------------------
// isValidShare
// ---------------------------------------------------------------------------
describe('isValidShare', () => {
  it('returns true for valid shares', () => {
    const shares = SSS.create(2, 2, 'validity check');
    shares.forEach((s) => {
      expect(SSS.isValidShare(s)).toBe(true);
    });
  });

  it('returns false for empty string', () => {
    expect(SSS.isValidShare('')).toBe(false);
  });

  it('returns false for garbage', () => {
    expect(SSS.isValidShare('not-a-valid-share')).toBe(false);
  });

  it('returns false for wrong length', () => {
    expect(SSS.isValidShare('AAAA')).toBe(false);
  });

  it('returns false for null', () => {
    expect(SSS.isValidShare(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(SSS.isValidShare(undefined)).toBe(false);
  });

  it('returns false for number', () => {
    expect(SSS.isValidShare(123)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Multibyte UTF-8
// ---------------------------------------------------------------------------
describe('Multibyte UTF-8', () => {
  const cases = [
    '\u00e9\u00e0\u00fc',                                   // accented Latin
    '\u4f60\u597d\u4e16\u754c',                              // CJK
    '\ud83d\udd12\ud83d\udee1\ufe0f\ud83d\udd11',           // emoji
    'mix: caf\u00e9 \u2615 \u2603\ufe0f end',               // mixed
  ];

  it.each(cases)('round-trips "%s"', (s) => {
    const shares = SSS.create(2, 3, s);
    const recovered = SSS.combine(shares.slice(0, 2));
    expect(recovered).toBe(s);
  });
});

// ---------------------------------------------------------------------------
// timestampedName
// ---------------------------------------------------------------------------
describe('timestampedName', () => {
  it('starts with the given prefix', () => {
    const name = SSS.timestampedName('sss-');
    expect(name.startsWith('sss-')).toBe(true);
  });

  it('contains a date-like segment', () => {
    const name = SSS.timestampedName('test-');
    expect(name).toMatch(/^test-\d{8}-\d{6}-.+$/);
  });
});

// ---------------------------------------------------------------------------
// parseShare
// ---------------------------------------------------------------------------
describe('parseShare', () => {
  it('parses a v2 share with name', () => {
    const shares = SSS.create(3, 5, 'test secret', { name: 'My_wallet' });
    const parsed = SSS.parseShare(shares[0]);
    expect(parsed).not.toBeNull();
    expect(parsed.version).toBe(2);
    expect(parsed.threshold).toBe(3);
    expect(parsed.name).toBe('My wallet');
    expect(parsed.payload.length % 88).toBe(0);
  });

  it('parses a v2 share without name', () => {
    const shares = SSS.create(2, 3, 'test', {});
    const parsed = SSS.parseShare(shares[0]);
    expect(parsed).not.toBeNull();
    expect(parsed.version).toBe(2);
    expect(parsed.threshold).toBe(2);
    expect(parsed.name).toBe('');
    expect(parsed.payload.length % 88).toBe(0);
  });

  it('parses a v0 share', () => {
    const shares = SSS.create(2, 3, 'test');
    const parsed = SSS.parseShare(shares[0]);
    expect(parsed).not.toBeNull();
    expect(parsed.version).toBe(0);
    expect(parsed.threshold).toBeNull();
    expect(parsed.name).toBeNull();
    expect(parsed.payload).toBe(shares[0]);
  });

  it('returns null for garbage', () => {
    expect(SSS.parseShare('garbage')).toBeNull();
    expect(SSS.parseShare('')).toBeNull();
    expect(SSS.parseShare(null)).toBeNull();
  });

  it('caps threshold display at 99', () => {
    const shares = SSS.create(120, 130, 'big threshold', { name: 'test' });
    const parsed = SSS.parseShare(shares[0]);
    expect(parsed.threshold).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// sanitizeName
// ---------------------------------------------------------------------------
describe('sanitizeName', () => {
  it('converts spaces to underscores', () => {
    expect(SSS.sanitizeName('My wallet')).toBe('My_wallet');
  });

  it('truncates to 20 characters', () => {
    expect(SSS.sanitizeName('a'.repeat(25))).toBe('a'.repeat(20));
  });

  it('returns empty string for empty input', () => {
    expect(SSS.sanitizeName('')).toBe('');
    expect(SSS.sanitizeName(undefined)).toBe('');
  });
});
