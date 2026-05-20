// =============================================================================
// src/__tests__/schemas.test.ts — Zod schema validation tests
// =============================================================================

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Inline the schemas so tests don't import Next.js server code
const listQuerySchema = z.object({
  page:       z.coerce.number().int().min(1).default(1),
  limit:      z.coerce.number().int().min(1).max(200).default(50),
  size:       z.string().optional(),
  cropType:   z.enum(['avatar', 'avatar-bust', 'avatar-headshot']).optional(),
  userId:     z.coerce.number().int().optional(),
  format:     z.enum(['png', 'jpeg', 'webp']).optional(),
  isDuplicate: z.enum(['true', 'false']).optional(),
});

const createJobSchema = z.discriminatedUnion('strategy', [
  z.object({
    name:        z.string().max(100).optional(),
    strategy:    z.literal('user-range'),
    startUserId: z.number().int().positive(),
    endUserId:   z.number().int().positive(),
    batchSize:   z.number().int().min(1).max(100).default(100),
    sizes:       z.array(z.string()).default(['420x420', '720x720']),
    cropTypes:   z.array(z.enum(['avatar', 'avatar-bust', 'avatar-headshot'])).default(['avatar']),
    format:      z.enum(['png', 'jpeg', 'webp']).default('png'),
    downloadImages: z.boolean().default(true),
  }),
  z.object({
    name:      z.string().max(100).optional(),
    strategy:  z.literal('game-search'),
    keyword:   z.string().min(1).max(200),
    limit:     z.number().int().positive().max(1000).default(100),
    sizes:     z.array(z.string()).default(['512x512']),
    downloadImages: z.boolean().default(true),
  }),
  z.object({
    name:      z.string().max(100).optional(),
    strategy:  z.literal('popular-games'),
    limit:     z.number().int().positive().max(1000).default(100),
    sizes:     z.array(z.string()).default(['512x512']),
    downloadImages: z.boolean().default(true),
  }),
]);

// ── listQuerySchema ───────────────────────────────────────────────────────────

describe('listQuerySchema', () => {
  it('applies default page=1 and limit=50', () => {
    const result = listQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(50);
  });

  it('coerces string numbers', () => {
    const result = listQuerySchema.parse({ page: '3', limit: '25' });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(25);
  });

  it('rejects limit > 200', () => {
    expect(() => listQuerySchema.parse({ limit: '201' })).toThrow();
  });

  it('rejects invalid cropType', () => {
    expect(() => listQuerySchema.parse({ cropType: 'full-body' })).toThrow();
  });

  it('accepts valid cropType values', () => {
    const valid = ['avatar', 'avatar-bust', 'avatar-headshot'] as const;
    for (const cropType of valid) {
      expect(() => listQuerySchema.parse({ cropType })).not.toThrow();
    }
  });
});

// ── createJobSchema ───────────────────────────────────────────────────────────

describe('createJobSchema — user-range', () => {
  it('parses valid user-range job', () => {
    const result = createJobSchema.parse({
      strategy:    'user-range',
      startUserId: 1,
      endUserId:   100,
    }) as Extract<z.infer<typeof createJobSchema>, { strategy: 'user-range' }>;
    expect(result.strategy).toBe('user-range');
    expect(result.batchSize).toBe(100);
    expect(result.format).toBe('png');
  });

  it('rejects user-range with non-positive userId', () => {
    expect(() => createJobSchema.parse({
      strategy:    'user-range',
      startUserId: 0,
      endUserId:   100,
    })).toThrow();
  });
});

describe('createJobSchema — game-search', () => {
  it('parses valid game-search job', () => {
    const result = createJobSchema.parse({
      strategy: 'game-search',
      keyword:  'adopt me',
    }) as Extract<z.infer<typeof createJobSchema>, { strategy: 'game-search' }>;
    expect(result.strategy).toBe('game-search');
    expect(result.limit).toBe(100);
  });

  it('rejects empty keyword', () => {
    expect(() => createJobSchema.parse({
      strategy: 'game-search',
      keyword:  '',
    })).toThrow();
  });
});

describe('createJobSchema — popular-games', () => {
  it('parses with default limit', () => {
    const result = createJobSchema.parse({ strategy: 'popular-games' }) as Extract<z.infer<typeof createJobSchema>, { strategy: 'popular-games' }>;
    expect(result.strategy).toBe('popular-games');
    expect(result.limit).toBe(100);
  });

  it('rejects limit > 1000', () => {
    expect(() => createJobSchema.parse({
      strategy: 'popular-games',
      limit:    9999,
    })).toThrow();
  });
});
