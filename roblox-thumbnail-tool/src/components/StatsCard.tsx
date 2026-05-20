'use client';

// =============================================================================
// src/components/StatsCard.tsx — Animated metric card
// =============================================================================

import { useEffect, useRef, useState } from 'react';

interface StatsCardProps {
  label: string;
  value: number | string;
  subtitle?: string;
  icon: string;
  color?: 'primary' | 'success' | 'warning' | 'error' | 'info';
  trend?: { value: number; label: string };
}

function AnimatedNumber({ target }: { target: number }) {
  const [current, setCurrent] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const startTime = performance.now();
    const duration = 900;
    const start = 0;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(start + (target - start) * ease));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target]);

  return <>{current.toLocaleString()}</>;
}

const COLOR_MAP = {
  primary: {
    glow: 'rgba(99,102,241,0.25)',
    icon: '#818cf8',
    iconBg: 'rgba(99,102,241,0.12)',
    bar: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
  },
  success: {
    glow: 'rgba(16,185,129,0.2)',
    icon: '#34d399',
    iconBg: 'rgba(16,185,129,0.12)',
    bar: 'linear-gradient(135deg,#10b981,#34d399)',
  },
  warning: {
    glow: 'rgba(245,158,11,0.2)',
    icon: '#fbbf24',
    iconBg: 'rgba(245,158,11,0.12)',
    bar: 'linear-gradient(135deg,#f59e0b,#fbbf24)',
  },
  error: {
    glow: 'rgba(239,68,68,0.2)',
    icon: '#f87171',
    iconBg: 'rgba(239,68,68,0.12)',
    bar: 'linear-gradient(135deg,#ef4444,#f87171)',
  },
  info: {
    glow: 'rgba(59,130,246,0.2)',
    icon: '#60a5fa',
    iconBg: 'rgba(59,130,246,0.12)',
    bar: 'linear-gradient(135deg,#3b82f6,#60a5fa)',
  },
};

export function StatsCard({
  label,
  value,
  subtitle,
  icon,
  color = 'primary',
  trend,
}: StatsCardProps) {
  const c = COLOR_MAP[color];

  return (
    <div
      className="card animate-fade-in"
      style={{
        position: 'relative',
        overflow: 'hidden',
        transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = `0 0 24px ${c.glow}, 0 4px 16px rgba(0,0,0,0.3)`;
        (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow)';
        (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
      }}
    >
      {/* Decorative glow blob */}
      <div
        style={{
          position: 'absolute',
          top: '-20px',
          right: '-20px',
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: c.glow,
          filter: 'blur(20px)',
          pointerEvents: 'none',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', fontWeight: 500, marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {label}
          </p>
          <p style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
            {typeof value === 'number' ? <AnimatedNumber target={value} /> : value}
          </p>
          {subtitle && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{subtitle}</p>
          )}
          {trend && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: trend.value >= 0 ? '#34d399' : '#f87171' }}>
                {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{trend.label}</span>
            </div>
          )}
        </div>
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: c.iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      </div>
      {/* Bottom accent bar */}
      <div style={{ height: '3px', background: c.bar, borderRadius: '0 0 2px 2px', position: 'absolute', bottom: 0, left: 0, right: 0 }} />
    </div>
  );
}
