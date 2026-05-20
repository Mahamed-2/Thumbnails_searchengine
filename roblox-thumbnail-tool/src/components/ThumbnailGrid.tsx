'use client';

// =============================================================================
// src/components/ThumbnailGrid.tsx — Thumbnail display component
// =============================================================================

import type { Thumbnail } from '@/types';

interface ThumbnailGridProps {
  thumbnails: Thumbnail[];
  isLoading: boolean;
}

export function ThumbnailGrid({ thumbnails, isLoading }: ThumbnailGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="aspect-square skeleton rounded-xl"></div>
        ))}
      </div>
    );
  }

  if (thumbnails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center border border-[var(--border)] rounded-2xl bg-[var(--bg-elevated)]">
        <div className="w-16 h-16 mb-4 rounded-full bg-[var(--bg-surface)] flex items-center justify-center">
          <svg className="w-8 h-8 text-[#a5a3c2]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-white">No thumbnails found</h3>
        <p className="text-sm text-[#a5a3c2] mt-1 max-w-sm">
          Try adjusting your filters or start a new collection job to gather more data.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {thumbnails.map((thumb) => (
        <div 
          key={thumb.id} 
          className="group relative aspect-square rounded-xl overflow-hidden bg-[var(--bg-elevated)] border border-[var(--border)] transition-all hover:border-[var(--primary-500)] hover:shadow-[0_0_15px_rgba(99,102,241,0.2)]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={thumb.cloudUrl || thumb.imageUrl} 
            alt={`Roblox user ${thumb.userId}`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
            <div className="text-xs font-medium text-white truncate">User {thumb.userId}</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/20 backdrop-blur-sm text-white">
                {thumb.format}
              </span>
              <span className="text-[10px] text-[#a5b4fc] truncate">
                {thumb.size}
              </span>
            </div>
          </div>
          {thumb.isDuplicate && (
            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[var(--warning)] shadow-[0_0_8px_var(--warning)]" title="Duplicate Image"></div>
          )}
        </div>
      ))}
    </div>
  );
}
