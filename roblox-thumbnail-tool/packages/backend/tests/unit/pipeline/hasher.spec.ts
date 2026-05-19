// =============================================================================
// tests/unit/pipeline/hasher.spec.ts — pHash Unit Tests
// =============================================================================

import { describe, it, expect, jest } from '@jest/globals';
import { hammingDistance, isDuplicate } from '../../../src/pipeline/hasher';

jest.mock('@config/env', () => ({
  env: {
    PHASH_SIMILARITY_THRESHOLD: 90,
  }
}));

describe('Hasher module', () => {
  describe('hammingDistance', () => {
    it('calculates 0 distance for identical hashes', () => {
      expect(hammingDistance('1234abcd', '1234abcd')).toBe(0);
    });

    it('calculates correct distance for different hashes', () => {
      // '0' is 0000, '1' is 0001 (distance 1)
      expect(hammingDistance('0', '1')).toBe(1);
      // '0' is 0000, 'f' is 1111 (distance 4)
      expect(hammingDistance('0', 'f')).toBe(4);
    });

    it('throws if hashes have different lengths', () => {
      expect(() => hammingDistance('abc', 'ab')).toThrow('Hashes must be of the same length');
    });
  });

  describe('isDuplicate', () => {
    it('returns true for identical hashes', () => {
      expect(isDuplicate('1234567890abcdef', '1234567890abcdef')).toBe(true);
    });

    it('returns true for highly similar hashes (> 90%)', () => {
      // Max distance for 16 chars = 64 bits
      // 90% of 64 is 57.6, meaning a distance of <= 6 is considered duplicate
      const hash1 = '1234567890abcdef';
      // 'f' (1111) vs 'e' (1110) -> distance 1
      const hash2 = '1234567890abcdee';
      expect(isDuplicate(hash1, hash2)).toBe(true);
    });

    it('returns false for dissimilar hashes (< 90%)', () => {
      const hash1 = '1234567890abcdef';
      const hash2 = 'fedcba0987654321';
      expect(isDuplicate(hash1, hash2)).toBe(false);
    });
  });
});
