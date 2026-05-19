// =============================================================================
// src/config/env.ts — Environment validation with Zod
// Fails fast at startup if required variables are missing or invalid.
// =============================================================================

import { z } from 'zod';

const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_PORT: z.coerce.number().int().min(1024).max(65535).default(3001),
  APP_HOST: z.string().default('0.0.0.0'),
  APP_LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  APP_SECRET: z.string().min(32, 'APP_SECRET must be at least 32 characters'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.coerce.number().int().default(0),
  REDIS_URL: z.string().url().optional(),

  // Storage
  STORAGE_PROVIDER: z.enum(['local', 'supabase', 'cloudinary']).default('local'),
  DATA_DIR: z.string().default('./data'),
  IMAGES_DIR: z.string().default('./data/images'),

  // Supabase (optional)
  SUPABASE_URL: z.string().url().optional().or(z.literal('')),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_BUCKET: z.string().default('thumbnails'),

  // Cloudinary (optional)
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // Roblox API
  ROBLOX_API_BASE_URL: z.string().url().default('https://thumbnails.roblox.com'),
  ROBLOX_GAMES_API_URL: z.string().url().default('https://games.roblox.com'),
  ROBLOX_USERS_API_URL: z.string().url().default('https://users.roblox.com'),
  ROBLOX_RATE_LIMIT_MIN_TIME: z.coerce.number().int().default(100),
  ROBLOX_RATE_LIMIT_MAX_CONCURRENT: z.coerce.number().int().default(5),
  ROBLOX_CACHE_TTL_SECONDS: z.coerce.number().int().default(3600),

  // Fallback APIs
  BING_API_KEY: z.string().optional(),
  DUCKDUCKGO_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),

  // Queue
  QUEUE_CONCURRENCY: z.coerce.number().int().default(10),
  QUEUE_MAX_ATTEMPTS: z.coerce.number().int().default(3),
  QUEUE_BACKOFF_DELAY_MS: z.coerce.number().int().default(1000),
  QUEUE_REMOVE_ON_COMPLETE: z.coerce.number().int().default(50),
  DLQ_NAME: z.string().default('thumbnail-dlq'),

  // Image Processing
  MIN_IMAGE_WIDTH: z.coerce.number().int().default(100),
  MIN_IMAGE_HEIGHT: z.coerce.number().int().default(100),
  PHASH_SIMILARITY_THRESHOLD: z.coerce.number().int().min(0).max(100).default(90),
  DEFAULT_OUTPUT_FORMAT: z.enum(['png', 'jpeg', 'webp']).default('png'),
  DEFAULT_OUTPUT_QUALITY: z.coerce.number().int().min(1).max(100).default(85),
  ENABLE_DEDUPLICATION: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
  ENABLE_METADATA_EXTRACTION: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),

  // Observability
  METRICS_ENABLED: z
    .string()
    .transform((v) => v === 'true')
    .default('true'),
  METRICS_PORT: z.coerce.number().int().default(9090),
  HEALTH_CHECK_PATH: z.string().default('/health'),
  READINESS_CHECK_PATH: z.string().default('/ready'),
});

function validateEnv() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const formatted = Object.entries(errors)
      .map(([key, msgs]) => `  ${key}: ${msgs?.join(', ')}`)
      .join('\n');

    throw new Error(`❌ Environment validation failed:\n${formatted}`);
  }

  return result.data;
}

export const env = validateEnv();
export type Env = typeof env;
