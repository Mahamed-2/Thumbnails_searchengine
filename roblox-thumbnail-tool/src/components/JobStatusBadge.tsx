'use client';

// =============================================================================
// src/components/JobStatusBadge.tsx — Status pill component
// =============================================================================

import type { JobStatus } from '@/types';

const STATUS_CONFIG: Record<
  string,
  { label: string; dot: string; bg: string; color: string }
> = {
  pending: {
    label: 'Pending',
    dot: '#fbbf24',
    bg: 'rgba(245,158,11,0.12)',
    color: '#fcd34d',
  },
  running: {
    label: 'Running',
    dot: '#34d399',
    bg: 'rgba(16,185,129,0.12)',
    color: '#6ee7b7',
  },
  completed: {
    label: 'Completed',
    dot: '#818cf8',
    bg: 'rgba(99,102,241,0.12)',
    color: '#a5b4fc',
  },
  failed: {
    label: 'Failed',
    dot: '#f87171',
    bg: 'rgba(239,68,68,0.12)',
    color: '#fca5a5',
  },
  cancelled: {
    label: 'Cancelled',
    dot: '#6b7280',
    bg: 'rgba(107,114,128,0.12)',
    color: '#9ca3af',
  },
};

interface JobStatusBadgeProps {
  status: JobStatus | string;
}

export function JobStatusBadge({ status }: JobStatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    dot: '#6b7280',
    bg: 'rgba(107,114,128,0.12)',
    color: '#9ca3af',
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '3px 10px',
        borderRadius: '100px',
        background: cfg.bg,
        color: cfg.color,
        fontSize: '0.75rem',
        fontWeight: 600,
        letterSpacing: '0.03em',
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: cfg.dot,
          flexShrink: 0,
          animation: status === 'running' ? 'pulse-glow 2s ease-in-out infinite' : undefined,
        }}
      />
      {cfg.label}
    </span>
  );
}
