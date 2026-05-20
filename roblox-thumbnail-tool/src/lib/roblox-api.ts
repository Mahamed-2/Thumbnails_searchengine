// =============================================================================
// src/lib/roblox-api.ts — Typed Roblox API adapter
// Rate-limited, retrying, strongly typed wrappers for all Roblox endpoints used.
// =============================================================================

const THUMBNAIL_API = 'https://thumbnails.roblox.com';
const GAMES_API     = 'https://games.roblox.com';
const USERS_API     = 'https://users.roblox.com';

/** Minimum milliseconds between requests (default: 100ms = ~10 req/s) */
const MIN_DELAY_MS = Number(process.env.ROBLOX_RATE_LIMIT_MIN_TIME ?? 100);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Generic Roblox API fetcher with retry and rate-limiting. */
async function robloxFetch<T>(url: string, attempts = 3): Promise<T> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'RobloxThumbnailEngine/1.0' },
        signal: AbortSignal.timeout(12000),
      });
      if (res.status === 429) {
        // Respect Roblox rate limits with exponential backoff
        const retryAfter = Number(res.headers.get('Retry-After') ?? attempt * 2);
        await sleep(retryAfter * 1000);
        continue;
      }
      if (!res.ok) {
        throw new Error(`Roblox API HTTP ${res.status} for ${url}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      if (attempt === attempts) throw err;
      await sleep(MIN_DELAY_MS * attempt * 2);
    }
  }
  throw new Error(`All ${attempts} attempts failed for ${url}`);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type ThumbnailCropType = 'avatar' | 'avatar-bust' | 'avatar-headshot';
export type ThumbnailFormat   = 'png' | 'jpeg' | 'webp';
export type ThumbnailState    = 'Completed' | 'Pending' | 'Blocked' | 'Error' | 'InReview' | 'TemporarilyUnavailable';

export interface RobloxThumbnail {
  targetId:  number;
  state:     ThumbnailState;
  imageUrl:  string;
  version:   string;
}

export interface RobloxGame {
  id:          number;
  name:        string;
  description: string;
  creator:     { id: number; type: 'User' | 'Group'; name: string };
  playing:     number;
  visits:      number;
  maxPlayers:  number;
}

export interface RobloxUser {
  id:          number;
  name:        string;
  displayName: string;
  isBanned:    boolean;
}

export interface RobloxUserDetails {
  id:          number;
  name:        string;
  displayName: string;
  description?: string;
  isBanned:    boolean;
  created:     string;
}

// ── User Thumbnails ───────────────────────────────────────────────────────────

/**
 * Fetch avatar thumbnails for up to 100 user IDs per call.
 * Automatically chunks larger arrays.
 */
export async function fetchUserThumbnails(
  userIds:  number[],
  size:     string         = '420x420',
  cropType: ThumbnailCropType = 'avatar',
  format:   ThumbnailFormat  = 'png',
): Promise<RobloxThumbnail[]> {
  const CHUNK_SIZE = 100;
  const results: RobloxThumbnail[] = [];

  for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
    const chunk = userIds.slice(i, i + CHUNK_SIZE);
    const url   = `${THUMBNAIL_API}/v1/users/${cropType}?userIds=${chunk.join(',')}&size=${size}&format=${format}&isCircular=false`;

    try {
      const body = await robloxFetch<{ data: RobloxThumbnail[] }>(url);
      results.push(...(body.data ?? []));
    } catch (err) {
      console.error(`[roblox-api] fetchUserThumbnails chunk ${i} failed:`, err);
    }

    if (i + CHUNK_SIZE < userIds.length) {
      await sleep(MIN_DELAY_MS);
    }
  }

  return results;
}

// ── Game Thumbnails ───────────────────────────────────────────────────────────

export async function fetchGameIcons(
  universeIds: number[],
  size:        string = '512x512',
  format:      ThumbnailFormat = 'png',
): Promise<RobloxThumbnail[]> {
  const CHUNK_SIZE = 100;
  const results: RobloxThumbnail[] = [];

  for (let i = 0; i < universeIds.length; i += CHUNK_SIZE) {
    const chunk = universeIds.slice(i, i + CHUNK_SIZE);
    const url   = `${THUMBNAIL_API}/v1/games/icons?universeIds=${chunk.join(',')}&size=${size}&format=${format}&isCircular=false`;

    try {
      const body = await robloxFetch<{ data: RobloxThumbnail[] }>(url);
      results.push(...(body.data ?? []));
    } catch (err) {
      console.error(`[roblox-api] fetchGameIcons chunk ${i} failed:`, err);
    }

    if (i + CHUNK_SIZE < universeIds.length) {
      await sleep(MIN_DELAY_MS);
    }
  }

  return results;
}

// ── Games Search / Listing ────────────────────────────────────────────────────

export async function searchGames(keyword: string, limit = 50): Promise<RobloxGame[]> {
  const url = `${GAMES_API}/v1/games/list?keyword=${encodeURIComponent(keyword)}&limit=${Math.min(limit, 100)}`;
  const body = await robloxFetch<{ games: RobloxGame[] }>(url);
  return body.games ?? [];
}

export async function fetchPopularGames(limit = 50): Promise<RobloxGame[]> {
  const url = `${GAMES_API}/v1/games/list?sortFilter=default&limit=${Math.min(limit, 100)}`;
  const body = await robloxFetch<{ games: RobloxGame[] }>(url);
  return body.games ?? [];
}

// ── Users ─────────────────────────────────────────────────────────────────────

/**
 * Batch-fetch basic user info for up to 200 user IDs per call.
 */
export async function fetchUsers(userIds: number[]): Promise<RobloxUser[]> {
  const CHUNK_SIZE = 200;
  const results: RobloxUser[] = [];

  for (let i = 0; i < userIds.length; i += CHUNK_SIZE) {
    const chunk = userIds.slice(i, i + CHUNK_SIZE);
    const url   = `${USERS_API}/v1/users?userIds=${chunk.join(',')}`;

    try {
      const body = await robloxFetch<{ data: RobloxUser[] }>(url);
      results.push(...(body.data ?? []));
    } catch (err) {
      console.error(`[roblox-api] fetchUsers chunk ${i} failed:`, err);
    }

    if (i + CHUNK_SIZE < userIds.length) {
      await sleep(MIN_DELAY_MS);
    }
  }

  return results;
}

export async function fetchUserDetails(userId: number): Promise<RobloxUserDetails | null> {
  try {
    return await robloxFetch<RobloxUserDetails>(`${USERS_API}/v1/users/${userId}`);
  } catch {
    return null;
  }
}
