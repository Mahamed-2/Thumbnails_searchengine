// =============================================================================
// src/components/ui/Skeleton.tsx
// =============================================================================

import { clsx } from 'clsx';
import { type HTMLAttributes } from 'react';

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** Shorthand height class, e.g. 'h-4', 'h-8' */
  height?: string;
  /** Shorthand width class, e.g. 'w-full', 'w-32' */
  width?: string;
  rounded?: boolean;
}

export function Skeleton({ height = 'h-4', width = 'w-full', rounded = false, className, ...props }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label="Loading…"
      className={clsx('skeleton', height, width, rounded && 'rounded-full', className)}
      {...props}
    />
  );
}

/** Convenience compound for a card skeleton */
export function CardSkeleton() {
  return (
    <div className="card space-y-4 animate-fade-in">
      <Skeleton height="h-5" width="w-1/3" />
      <Skeleton height="h-8" width="w-2/3" />
      <Skeleton height="h-3" width="w-full" />
    </div>
  );
}
