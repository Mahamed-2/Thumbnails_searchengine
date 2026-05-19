// =============================================================================
// src/types/roblox.ts — Complete TypeScript types for all Roblox API responses
// Ref: https://thumbnails.roblox.com / https://games.roblox.com / https://users.roblox.com
// =============================================================================

// ── Generic API Response Wrapper ───────────────────────────────────────────────
export interface RobloxApiResponse<T> {
  data: T[];
  nextPageCursor?: string;
  previousPageCursor?: string;
}

// ── Thumbnail State ────────────────────────────────────────────────────────────
export type ThumbnailState = 'Completed' | 'Pending' | 'Blocked' | 'Error' | 'InReview' | 'TemporarilyUnavailable';

// ── Thumbnail Types ────────────────────────────────────────────────────────────
export type ThumbnailCropType = 'avatar' | 'avatar-bust' | 'avatar-headshot';

export type ThumbnailSize =
  // Avatar (full body)
  | '30x30' | '48x48' | '60x60' | '75x75' | '100x100'
  | '110x110' | '140x140' | '150x150' | '180x180' | '250x250'
  | '352x352' | '420x420' | '720x720'
  // Avatar bust
  | '48x48' | '50x50' | '60x60' | '75x75' | '100x100'
  | '150x150' | '180x180' | '352x352' | '420x420'
  // Avatar headshot
  // (overlapping with above)
  // Game icons
  | '50x50' | '128x128' | '150x150' | '256x256' | '512x512'
  // Game thumbnails
  | '768x432' | '576x324' | '480x270' | '384x216';

export type ThumbnailFormat = 'png' | 'jpeg' | 'webp';

// ── Player Thumbnail Response ──────────────────────────────────────────────────
export interface PlayerThumbnail {
  targetId: number;       // User ID
  state: ThumbnailState;
  imageUrl: string | null;
  version?: string;
}

export interface PlayerThumbnailResponse extends RobloxApiResponse<PlayerThumbnail> {}

// ── Game Icon Response ─────────────────────────────────────────────────────────
export interface GameIcon {
  targetId: number;       // Universe/Game ID
  state: ThumbnailState;
  imageUrl: string | null;
  version?: string;
}

export interface GameIconResponse extends RobloxApiResponse<GameIcon> {}

// ── Game Thumbnail Response ────────────────────────────────────────────────────
export interface GameThumbnail {
  targetId: number;
  state: ThumbnailState;
  imageUrl: string | null;
}

// ── Group Icon Response ────────────────────────────────────────────────────────
export interface GroupIcon {
  targetId: number;
  state: ThumbnailState;
  imageUrl: string | null;
}

// ── Games API ─────────────────────────────────────────────────────────────────
export interface GameCreator {
  id: number;
  type: 'User' | 'Group';
  name: string;
}

export interface Game {
  id: number;             // Universe ID
  rootPlaceId: number;
  name: string;
  description: string;
  sourceName?: string;
  sourceDescription?: string;
  creator: GameCreator;
  price?: number;
  allowedGearGenres?: string[];
  allowedGearCategories?: string[];
  isGenreEnforced?: boolean;
  copyingAllowed?: boolean;
  playing: number;
  visits: number;
  maxPlayers: number;
  created: string;        // ISO datetime
  updated: string;
  studioAccessToApisAllowed?: boolean;
  createVipServersAllowed?: boolean;
  universeAvatarType?: string;
  genre?: string;
  isAllGenre?: boolean;
  isFavorited?: boolean;
  favoritedCount?: number;
}

export interface GamesListResponse {
  games: Game[];
  nextPageCursor?: string;
  previousPageCursor?: string;
  suggestedKeyword?: string;
  correctedKeyword?: string;
  filteredKeyword?: string;
  hasMoreRows?: boolean;
  keyword?: string | null;
  totalCount?: number;
}

// ── Users API ─────────────────────────────────────────────────────────────────
export interface RobloxUser {
  id: number;
  name: string;
  displayName: string;
  description?: string;
  created?: string;
  isBanned?: boolean;
  externalAppDisplayName?: string;
  hasVerifiedBadge?: boolean;
}

export interface UsersResponse {
  data: RobloxUser[];
}

// ── Username → User ID Lookup ──────────────────────────────────────────────────
export interface UsernameLookup {
  requestedUsername: string;
  hasVerifiedBadge: boolean;
  id: number;
  name: string;
  displayName: string;
}

// ── Rate Limit Headers ─────────────────────────────────────────────────────────
export interface RobloxRateLimitHeaders {
  'x-ratelimit-limit'?: string;
  'x-ratelimit-remaining'?: string;
  'x-ratelimit-reset'?: string;
  'retry-after'?: string;
}

// ── Fetch Options ──────────────────────────────────────────────────────────────
export interface ThumbnailFetchOptions {
  size?: ThumbnailSize;
  format?: ThumbnailFormat;
  isCircular?: boolean;
  cropType?: ThumbnailCropType;
}

export interface GameThumbnailFetchOptions {
  size?: ThumbnailSize;
  format?: ThumbnailFormat;
  count?: number;
}

export interface GamesSearchOptions {
  keyword?: string;
  limit?: number;
  sortOrder?: 'Asc' | 'Desc';
  sortType?: 'Relevance' | 'Favorited' | 'Visits' | 'Rating' | 'UserRating';
  gameFilter?: string;
  maxRows?: number;
  excludeNonPlayableGames?: boolean;
  pageContext?: {
    pageId?: string;
    isSeeAllPage?: boolean;
  };
}
