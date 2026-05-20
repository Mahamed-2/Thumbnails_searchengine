'use client';

// =============================================================================
// src/components/AnalyticsChart.tsx
// Interactive Recharts area chart for thumbnail collection trends + job status pie
// =============================================================================

import { TrendingUp, Activity } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

import { Skeleton } from './ui/Skeleton';

interface TimeseriesPoint {
  date:  string;
  count: number;
}

interface TimeseriesResponse {
  thumbnails: TimeseriesPoint[];
  jobs: Record<string, Record<string, number>>;
}

const STATUS_COLORS: Record<string, string> = {
  completed: '#10b981',
  failed:    '#ef4444',
  running:   '#6366f1',
  pending:   '#f59e0b',
  cancelled: '#6b697e',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────────
function CustomAreaTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass rounded-lg px-3 py-2 text-sm border border-[var(--border-strong)]">
      <p className="text-[var(--text-secondary)] mb-1">{label}</p>
      <p className="font-semibold text-[var(--primary-300)]">
        {payload[0]?.value.toLocaleString()} thumbnails
      </p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
interface AnalyticsChartProps {
  days?: 7 | 14 | 30;
  jobStatusCounts?: Record<string, number>;
}

export function AnalyticsChart({ days = 14, jobStatusCounts }: AnalyticsChartProps) {
  const [data, setData]       = useState<TimeseriesPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod]   = useState<7 | 14 | 30>(days);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/analytics/timeseries?days=${period}`)
      .then((r) => r.json())
      .then((json: TimeseriesResponse) => {
        if (!cancelled) {
          setData((json.thumbnails ?? []).map((p) => ({ ...p, date: formatDate(p.date) })));
          setLoading(false);
        }
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [period]);

  // Build pie data from jobStatusCounts
  const pieData = Object.entries(jobStatusCounts ?? {})
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Area Chart — Thumbnail Collection Trend */}
      <div className="card lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2 text-[var(--text-primary)]">
            <TrendingUp size={18} className="text-[var(--primary-400)]" />
            Collection Trend
          </h3>
          <div className="flex gap-1" role="group" aria-label="Period selector">
            {([7, 14, 30] as const).map((d) => (
              <button
                key={d}
                onClick={() => setPeriod(d)}
                aria-pressed={period === d}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all duration-150 ${
                  period === d
                    ? 'bg-[var(--primary-500)] text-white'
                    : 'text-[var(--text-secondary)] hover:bg-white/5'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <Skeleton height="h-40" width="w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="thumbnailGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}   />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(99,102,241,0.1)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomAreaTooltip />} />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#6366f1"
                strokeWidth={2}
                fill="url(#thumbnailGrad)"
                dot={false}
                activeDot={{ r: 4, fill: '#a5b4fc', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Pie Chart — Job Status Distribution */}
      <div className="card space-y-4">
        <h3 className="font-semibold flex items-center gap-2 text-[var(--text-primary)]">
          <Activity size={18} className="text-[var(--accent-400)]" />
          Job Status
        </h3>

        {pieData.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-sm text-[var(--text-muted)]">
            No jobs yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={72}
                paddingAngle={3}
                dataKey="value"
              >
                {pieData.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={STATUS_COLORS[entry.name] ?? '#6b697e'}
                    opacity={0.9}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number, name: string) => [value.toLocaleString(), name]}
                contentStyle={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius)',
                  fontSize: '0.8rem',
                }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                formatter={(name) => (
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{name}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
