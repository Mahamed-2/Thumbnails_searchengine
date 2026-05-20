// =============================================================================
// src/components/ui/Badge.tsx
// =============================================================================

import { clsx } from 'clsx';
import { type HTMLAttributes } from 'react';

export type BadgeVariant = 'success' | 'error' | 'warning' | 'info' | 'neutral';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  dot?: boolean;
}

const variantClass: Record<BadgeVariant, string> = {
  success: 'badge-success',
  error:   'badge-error',
  warning: 'badge-warning',
  info:    'badge-info',
  neutral: 'badge-neutral',
};

const dotColor: Record<BadgeVariant, string> = {
  success: 'bg-emerald-400',
  error:   'bg-red-400',
  warning: 'bg-amber-400',
  info:    'bg-indigo-400',
  neutral: 'bg-gray-400',
};

export function Badge({ variant = 'info', dot = false, children, className, ...props }: BadgeProps) {
  return (
    <span
      className={clsx('badge', variantClass[variant], className)}
      {...props}
    >
      {dot && (
        <span
          className={clsx('inline-block w-1.5 h-1.5 rounded-full', dotColor[variant])}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
