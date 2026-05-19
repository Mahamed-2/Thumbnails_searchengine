import React from 'react';
import { cn } from '../../lib/utils';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0 to 100
}

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('relative h-2 w-full overflow-hidden rounded-full bg-surface-700', className)}
        {...props}
      >
        <div
          className="h-full w-full flex-1 bg-gradient-to-r from-primary-600 to-primary-400 transition-all duration-500 ease-in-out shadow-[0_0_10px_rgba(59,130,246,0.5)]"
          style={{ transform: `translateX(-${100 - Math.min(100, Math.max(0, value))}%)` }}
        />
      </div>
    );
  }
);
Progress.displayName = 'Progress';
