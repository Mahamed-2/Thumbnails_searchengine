// =============================================================================
// src/pipeline/downloader.ts — Image Download Adapter
// Fetches image buffers from Roblox CDN with timeout and retry logic.
// =============================================================================

import axios from 'axios';
import { createLogger } from '@observability/logger';
import { env } from '@config/env';

const logger = createLogger('downloader');

const downloadClient = axios.create({
  timeout: 10000, // 10 seconds max for image download
  responseType: 'arraybuffer',
  maxRedirects: 3,
});

export async function downloadImage(url: string, attempts = 3): Promise<Buffer> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await downloadClient.get<Buffer>(url);
      return Buffer.from(response.data);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (attempt === attempts) {
        logger.error({ url, error: errorMsg, attempt }, '❌ Failed to download image after retries');
        throw new Error(`Failed to download image from ${url}: ${errorMsg}`);
      }
      logger.warn({ url, error: errorMsg, attempt }, '⚠️ Image download failed, retrying...');
      // Simple backoff: 500ms, 1000ms...
      await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw new Error(`Failed to download image from ${url}`);
}
