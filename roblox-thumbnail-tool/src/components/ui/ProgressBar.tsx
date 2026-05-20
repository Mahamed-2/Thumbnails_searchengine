// =============================================================================
// src/components/ui/ProgressBar.tsx
// =============================================================================

import clsx from 'clsx';

interface ProgressBarProps {
  value: number; // 0–100
  label?: string;
  showValue?: boolean;
  className?: string;
  color?: 'default' | 'success' | 'warning' | 'error';
}

const colorMap: Record<string, string> = {
  default: 'linear-gradient(90deg, var(--primary-500), var(--accent-400))',
  success: 'linear-gradient(90deg, #10b981, #34d399)',
  warning: 'linear-gradient(90deg, #f59e0b, #fcd34d)',
  error:   'linear-gradient(90deg, #ef4444, #f87171)',
};

export function ProgressBar({ value, label, showValue = false, className, color = 'default' }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className={clsx('space-y-1', className)} aria-label={label}>
      {(label || showValue) && (
        <div className="flex justify-between items-center text-xs text-[var(--text-secondary)]">
          {label && <span>{label}</span>}
          {showValue && <span className="font-mono tabular-nums">{Math.round(clamped)}%</span>}
        </div>
      )}
      <div className="progress-bar" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
        <div
          className="progress-fill"
          style={{ width: `${clamped}%`, background: colorMap[color] }}
        />
      </div>
    </div>
  );
}
