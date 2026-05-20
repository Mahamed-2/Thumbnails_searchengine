// =============================================================================
// src/__tests__/pipeline.test.ts — Unit tests for the image processing pipeline
// =============================================================================

import { describe, it, expect } from 'vitest';
import { hammingDistance, isDuplicate, calculatePHash } from '../lib/pipeline';

// ── hammingDistance ───────────────────────────────────────────────────────────

describe('hammingDistance', () => {
  it('returns 0 for identical hashes', () => {
    expect(hammingDistance('deadbeef', 'deadbeef')).toBe(0);
  });

  it('returns correct distance for single-bit difference', () => {
    // 'f' = 1111, 'e' = 1110 → 1 bit different
    expect(hammingDistance('f', 'e')).toBe(1);
  });

  it('returns max distance for fully inverted hashes', () => {
    // '0' = 0000, 'f' = 1111 → 4 bits different per char
    expect(hammingDistance('0000', 'ffff')).toBe(16);
  });

  it('throws when hashes have different lengths', () => {
    expect(() => hammingDistance('ab', 'abc')).toThrow();
  });
});

// ── isDuplicate ───────────────────────────────────────────────────────────────

describe('isDuplicate', () => {
  it('returns true for identical hashes', () => {
    const hash = 'a'.repeat(64);
    expect(isDuplicate(hash, hash)).toBe(true);
  });

  it('returns false for completely different hashes', () => {
    const h1 = '0'.repeat(64);
    const h2 = 'f'.repeat(64);
    expect(isDuplicate(h1, h2)).toBe(false);
  });

  it('returns true for hashes within default 90% similarity threshold', () => {
    // Construct two hashes where only a small fraction differ
    const base = '0'.repeat(64);
    // Flip 1 out of 64 hex chars (1/64 ≈ 1.6% different → ~98.4% similar)
    const similar = 'f' + '0'.repeat(63);
    expect(isDuplicate(base, similar)).toBe(true);
  });
});

// ── calculatePHash ────────────────────────────────────────────────────────────

describe('calculatePHash', () => {
  it('returns a 64-character hex string for a valid buffer', async () => {
    // Dynamically import sharp to create a minimal 16x16 PNG buffer for testing
    const sharp = await import('sharp');
    const buffer = await sharp
      .default({ create: { width: 16, height: 16, channels: 3, background: { r: 128, g: 0, b: 0 } } })
      .png()
      .toBuffer();

    const hash = await calculatePHash(buffer);
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]+$/i.test(hash)).toBe(true);
  });

  it('produces the same hash for the same image', async () => {
    const sharp = await import('sharp');
    const buffer = await sharp
      .default({ create: { width: 32, height: 32, channels: 3, background: { r: 0, g: 255, b: 0 } } })
      .png()
      .toBuffer();

    const hash1 = await calculatePHash(buffer);
    const hash2 = await calculatePHash(buffer);
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for images with different luminance patterns', async () => {
    const sharp = await import('sharp');

    // Gradient image: left half black, right half white → pixels differ
    const leftBlackRightWhite = Buffer.alloc(16 * 16, 0); // 16x16 grayscale
    for (let y = 0; y < 16; y++) {
      for (let x = 8; x < 16; x++) {
        leftBlackRightWhite[y * 16 + x] = 255;
      }
    }

    const gradientImg = await sharp
      .default(leftBlackRightWhite, { raw: { width: 16, height: 16, channels: 1 } })
      .png()
      .toBuffer();

    // Inverted: left half white, right half black
    const invertedBuf = Buffer.alloc(16 * 16, 0);
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 8; x++) {
        invertedBuf[y * 16 + x] = 255;
      }
    }

    const invertedImg = await sharp
      .default(invertedBuf, { raw: { width: 16, height: 16, channels: 1 } })
      .png()
      .toBuffer();

    const hash1 = await calculatePHash(gradientImg);
    const hash2 = await calculatePHash(invertedImg);
    expect(hash1).not.toBe(hash2);
  });
});
