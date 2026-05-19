// tests/setup.ts — Sets minimum required environment variables for unit tests
// This file runs before any test module is imported, satisfying Zod env validation.

process.env['NODE_ENV'] = 'test';
process.env['APP_SECRET'] = 'test-secret-that-is-at-least-32-characters-long!!';
process.env['DATABASE_URL'] = 'file:./data/test.db';
process.env['REDIS_HOST'] = 'localhost';
process.env['REDIS_PORT'] = '6379';
process.env['APP_LOG_LEVEL'] = 'error'; // Suppress logs in tests
process.env['METRICS_ENABLED'] = 'false';
process.env['DUCKDUCKGO_ENABLED'] = 'true';
process.env['STORAGE_PROVIDER'] = 'local';
