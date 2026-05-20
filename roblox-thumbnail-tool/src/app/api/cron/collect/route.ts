import { type NextRequest } from 'next/server';

import { handleApiRoute, jsonResponse } from '@/lib/api-helpers';
import { db } from '@/lib/db';
import { runPipeline } from '@/lib/pipeline';
import { acquireLock, enqueueJob, releaseLock } from '@/lib/queue';

// Serverless timeout limit (default: 8s for safety under 10s Hobby limit)
const SERVERLESS_TIMEOUT_MS = Number(process.env.SERVERLESS_TIMEOUT_MS ?? 8000);

// Roblox API helpers
async function fetchRobloxThumbnails(userIds: number[], size: string, format: string, cropType: string) {
  const url = `https://thumbnails.roblox.com/v1/users/${cropType}?userIds=${userIds.join(',')}&size=${size}&format=${format}&isCircular=false`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Roblox API returned status ${res.status}`);
    const body = await res.json();
    return body.data || [];
  } catch (error) {
    console.error('Error fetching Roblox thumbnails:', error);
    return [];
  }
}

async function fetchGamesList(keyword: string, limit: number) {
  const url = `https://games.roblox.com/v1/games/list?keyword=${encodeURIComponent(keyword)}&limit=${limit}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Roblox Games API returned status ${res.status}`);
    const body = await res.json();
    return body.games || [];
  } catch (error) {
    console.error('Error searching Roblox games:', error);
    return [];
  }
}

async function fetchGameIcons(universeIds: number[], size: string) {
  const url = `https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeIds.join(',')}&size=${size}&format=png`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Roblox Game Icons API returned status ${res.status}`);
    const body = await res.json();
    return body.data || [];
  } catch (error) {
    console.error('Error fetching game icons:', error);
    return [];
  }
}

async function fetchPopularGames(limit: number) {
  const url = `https://games.roblox.com/v1/games/list?sortFilter=default&limit=${limit}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Roblox Games list returned status ${res.status}`);
    const body = await res.json();
    return body.games || [];
  } catch (error) {
    console.error('Error fetching popular games:', error);
    return [];
  }
}

// Main Cron Runner logic
async function runWorker(request: NextRequest) {
  // 1. Verify Vercel Cron signature in production
  const authHeader = request.headers.get('authorization');
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const startTime = Date.now();

  // Find next job in queue (or DB fallback)
  let job = await db.collectionJob.findFirst({
    where: { status: 'running' },
  });

  if (!job) {
    job = await db.collectionJob.findFirst({
      where: { status: 'pending' },
    });
  }

  if (!job) {
    return jsonResponse({ message: 'No pending or running jobs found.' });
  }

  const jobId = job.id;

  // 2. Try to acquire the distributed lock
  const locked = await acquireLock(jobId, 60);
  if (!locked) {
    return jsonResponse({ message: 'Job is already locked and running elsewhere.', jobId });
  }

  try {
    // Set startedAt if not set yet
    if (!job.startedAt) {
      await db.collectionJob.update({
        where: { id: jobId },
        data: { status: 'running', startedAt: new Date() },
      });
    }

    const config = JSON.parse(job.config);
    const strategy = job.strategy;

    if (strategy === 'user-range') {
      const startUserId = config.startUserId;
      const endUserId = config.endUserId;
      const batchSize = config.batchSize ?? 10;
      const sizes = config.sizes ?? ['420x420'];
      const cropTypes = config.cropTypes ?? ['avatar'];
      const format = config.format ?? 'png';

      // Parse checkpoint state
      const checkpoint = job.checkpoint ? JSON.parse(job.checkpoint) : null;
      let lastUserId = checkpoint?.lastUserId ?? startUserId - 1;
      let sizeIdx = checkpoint?.sizeIdx ?? 0;
      let cropIdx = checkpoint?.cropIdx ?? 0;
      let processed = checkpoint?.processed ?? 0;
      let success = job.successItems;
      let failed = job.failedItems;

      const totalUsers = endUserId - startUserId + 1;
      const totalItems = totalUsers * sizes.length * cropTypes.length;

      // Update total items count in DB
      await db.collectionJob.update({
        where: { id: jobId },
        data: { totalItems },
      });

      let timeoutReached = false;

      for (let s = sizeIdx; s < sizes.length && !timeoutReached; s++) {
        const size = sizes[s];
        for (let c = cropIdx; c < cropTypes.length && !timeoutReached; c++) {
          const cropType = cropTypes[c];

          // Batch loop
          while (lastUserId < endUserId) {
            // Check time elapsed
            if (Date.now() - startTime > SERVERLESS_TIMEOUT_MS) {
              timeoutReached = true;
              break;
            }

            const batch: number[] = [];
            for (let i = 0; i < batchSize && lastUserId < endUserId; i++) {
              lastUserId++;
              batch.push(lastUserId);
            }

            if (batch.length === 0) break;

            const thumbnails = await fetchRobloxThumbnails(batch, size, format, cropType);

            for (const thumb of thumbnails) {
              processed++;
              if (!thumb.imageUrl || thumb.state === 'Blocked' || thumb.state === 'Error') {
                failed++;
                continue;
              }

              try {
                // Upsert User
                await db.user.upsert({
                  where: { robloxId: thumb.targetId },
                  create: { robloxId: thumb.targetId },
                  update: {},
                });

                // Execute the image pipeline to download, validate, and hash
                const [widthStr, heightStr] = size.split('x');
                const width = widthStr ? parseInt(widthStr, 10) : undefined;
                const height = heightStr ? parseInt(heightStr, 10) : undefined;

                const pipelineResult = await runPipeline(thumb.imageUrl, {
                  width,
                  height,
                  format: format as 'png' | 'jpeg' | 'webp',
                  userId: thumb.targetId,
                });

                let pHash: string | null = null;
                let isDuplicate = false;
                let fileSizeKb: number | null = null;
                let finalWidth: number | null = width ?? null;
                let finalHeight: number | null = height ?? null;

                if (pipelineResult.status === 'success' && pipelineResult.image) {
                  pHash = pipelineResult.pHash ?? null;
                  isDuplicate = pipelineResult.isDuplicate ?? false;
                  fileSizeKb = pipelineResult.image.sizeKb;
                  finalWidth = pipelineResult.image.width;
                  finalHeight = pipelineResult.image.height;
                }

                // Upsert Thumbnail with processed pipeline metadata
                await db.thumbnail.upsert({
                  where: {
                    userId_size_cropType: {
                      userId: thumb.targetId,
                      size,
                      cropType,
                    },
                  },
                  create: {
                    userId: thumb.targetId,
                    imageUrl: thumb.imageUrl,
                    size,
                    format,
                    cropType,
                    state: thumb.state,
                    pHash,
                    isDuplicate,
                    fileSizeKb,
                    width: finalWidth,
                    height: finalHeight,
                  },
                  update: {
                    imageUrl: thumb.imageUrl,
                    state: thumb.state,
                    pHash,
                    isDuplicate,
                    fileSizeKb,
                    width: finalWidth,
                    height: finalHeight,
                    updatedAt: new Date(),
                  },
                });

                success++;
              } catch (err) {
                failed++;
                console.error(`Error saving thumbnail for user ${thumb.targetId}:`, err);
              }
            }

            // DB progress update per batch
            const progress = totalItems > 0 ? Math.min(Math.round((processed / totalItems) * 100), 99) : 0;
            await db.collectionJob.update({
              where: { id: jobId },
              data: {
                processedItems: processed,
                successItems: success,
                failedItems: failed,
                progress,
                checkpoint: JSON.stringify({
                  lastUserId,
                  sizeIdx: s,
                  cropIdx: c,
                  processed,
                }),
              },
            });
          }

          if (!timeoutReached) {
            cropIdx = 0; // Reset crop index for next size loop
          }
        }
        if (!timeoutReached) {
          sizeIdx = 0; // Reset size index
        }
      }

      if (timeoutReached) {
        // Re-enqueue the job and release the lock to let another function run
        await enqueueJob(jobId);
        await releaseLock(jobId);
        return jsonResponse({
          status: 'checkpointed',
          message: 'Job exceeded serverless execution window and was checkpointed.',
          jobId,
          progress: job.progress,
        });
      }

      // Mark complete
      await db.collectionJob.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          progress: 100,
        },
      });
      await releaseLock(jobId);
      return jsonResponse({ status: 'completed', jobId });
    }

    if (strategy === 'game-search' || strategy === 'popular-games') {
      const limit = config.limit ?? 50;
      const size = config.sizes?.[0] ?? '512x512';

      const games =
        strategy === 'game-search'
          ? await fetchGamesList(config.keyword, limit)
          : await fetchPopularGames(limit);

      if (games.length === 0) {
        await db.collectionJob.update({
          where: { id: jobId },
          data: { status: 'completed', completedAt: new Date(), progress: 100 },
        });
        await releaseLock(jobId);
        return jsonResponse({ status: 'completed', message: 'No games found', jobId });
      }

      const gameIds = games.map((g: { id: number }) => g.id);
      const icons = await fetchGameIcons(gameIds, size);

      let processed = 0;
      let success = 0;
      let failed = 0;

      for (const game of games) {
        const icon = icons.find((ic: { targetId: number }) => ic.targetId === game.id);
        processed++;

        try {
          await db.game.upsert({
            where: { robloxId: game.id },
            create: {
              robloxId: game.id,
              name: game.name,
              description: game.description || '',
              playing: game.playing ?? 0,
              visits: BigInt(game.visits ?? 0),
              maxPlayers: game.maxPlayers ?? 0,
              thumbnailUrl: icon?.imageUrl ?? null,
            },
            update: {
              name: game.name,
              playing: game.playing ?? 0,
              visits: BigInt(game.visits ?? 0),
              thumbnailUrl: icon?.imageUrl ?? null,
              updatedAt: new Date(),
            },
          });
          success++;
        } catch (err) {
          failed++;
        }

        const progress = Math.min(Math.round((processed / games.length) * 100), 100);
        await db.collectionJob.update({
          where: { id: jobId },
          data: {
            processedItems: processed,
            successItems: success,
            failedItems: failed,
            progress,
          },
        });
      }

      await db.collectionJob.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          progress: 100,
        },
      });
      await releaseLock(jobId);
      return jsonResponse({ status: 'completed', jobId });
    }

    await releaseLock(jobId);
    return jsonResponse({ status: 'ignored', message: 'Unsupported strategy', jobId });
  } catch (error) {
    await db.collectionJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        errorLog: error instanceof Error ? error.message : String(error),
      },
    });
    await releaseLock(jobId);
    return jsonResponse({ status: 'failed', error: String(error) }, 500);
  }
}

export async function GET(request: NextRequest) {
  return handleApiRoute(async () => {
    return runWorker(request);
  });
}

export async function POST(request: NextRequest) {
  return handleApiRoute(async () => {
    return runWorker(request);
  });
}
