import React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'bg-surface-700 text-text-muted border border-surface-600',
    success: 'bg-green-500/10 text-green-400 border border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.1)]',
    warning: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 shadow-[0_0_10px_rgba(234,179,8,0.1)]',
    danger: 'bg-red-500/10 text-red-400 border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.1)]',
    info: 'bg-primary-500/10 text-primary-400 border border-primary-500/20 shadow-[0_0_10px_rgba(59,130,246,0.1)]',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none',
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
