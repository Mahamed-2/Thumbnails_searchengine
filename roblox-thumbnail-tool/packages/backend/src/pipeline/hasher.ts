// =============================================================================
// src/pipeline/hasher.ts — Perceptual Hasher
// Calculates pHash and checks similarity against existing hashes.
// =============================================================================

import { hash as imgHash } from 'imghash';
import { env } from '@config/env';

/**
 * Calculates a perceptual hash (pHash) for an image buffer.
 */
export async function calculatePHash(buffer: Buffer): Promise<string> {
  // Use a 16-bit hash for higher precision (256 bits total)
  return imgHash(buffer, 16, 'hex');
}

/**
 * Calculates the Hamming distance between two hex hashes.
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (hash1.length !== hash2.length) {
    throw new Error('Hashes must be of the same length');
  }

  let distance = 0;
  for (let i = 0; i < hash1.length; i++) {
    const n1 = parseInt(hash1[i] as string, 16);
    const n2 = parseInt(hash2[i] as string, 16);
    // XOR and count set bits (Kernighan's algorithm)
    let val = n1 ^ n2;
    while (val > 0) {
      distance += val & 1;
      val >>= 1;
    }
  }

  return distance;
}

/**
 * Checks if two hashes are considered duplicates based on the configured threshold.
 * Threshold is a percentage (0-100), e.g., 90 means 90% similar.
 */
export function isDuplicate(hash1: string, hash2: string): boolean {
  const maxDistance = hash1.length * 4; // Hex character = 4 bits
  const distance = hammingDistance(hash1, hash2);
  const similarity = ((maxDistance - distance) / maxDistance) * 100;
  
  return similarity >= env.PHASH_SIMILARITY_THRESHOLD;
}
