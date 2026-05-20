'use client';

// =============================================================================
// src/components/JobsTable.tsx — Recent Jobs Table
// =============================================================================

import { formatDistanceToNow } from 'date-fns';

import type { DashboardStats } from '@/types';

import { JobStatusBadge } from './JobStatusBadge';

interface JobsTableProps {
  jobs: DashboardStats['recentActivity'];
  isLoading: boolean;
}

export function JobsTable({ jobs, isLoading }: JobsTableProps) {
  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
        <div className="p-4 border-b border-[var(--border)]">
          <div className="h-6 w-32 skeleton rounded"></div>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-4 flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-4 w-48 skeleton rounded"></div>
                <div className="h-3 w-24 skeleton rounded"></div>
              </div>
              <div className="h-6 w-20 skeleton rounded-full"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="p-8 text-center border border-[var(--border)] rounded-xl bg-[var(--bg-elevated)]">
        <p className="text-sm text-[#a5a3c2]">No recent jobs found.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)]">
      <div className="p-4 border-b border-[var(--border)] flex justify-between items-center">
        <h3 className="font-semibold text-white">Recent Jobs</h3>
        <button className="text-xs text-[var(--primary-400)] hover:text-[var(--primary-300)] transition-colors">
          View All
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs uppercase text-[#a5a3c2] bg-[var(--bg-surface)]">
            <tr>
              <th className="px-4 py-3 font-medium">Job ID / Name</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Progress</th>
              <th className="px-4 py-3 font-medium text-right">Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {jobs.map((job) => (
              <tr key={job.id} className="hover:bg-[var(--bg-surface)] transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-white truncate max-w-[200px]">
                    {job.name || job.id.split('-')[0]}
                  </div>
                  <div className="text-xs text-[#a5a3c2] font-mono mt-0.5">
                    {job.id.substring(0, 8)}...
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <JobStatusBadge status={job.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-[var(--bg-surface)] rounded-full overflow-hidden w-24">
                      <div 
                        className="h-full bg-[var(--primary-500)] rounded-full transition-all"
                        style={{ width: `${Math.max(0, Math.min(100, job.progress))}%` }}
                      />
                    </div>
                    <span className="text-xs text-[#a5a3c2] min-w-[2.5rem] text-right">
                      {job.progress}%
                    </span>
                  </div>
                  <div className="text-[10px] text-[#a5a3c2] mt-1">
                    {job.processedItems.toLocaleString()} / {job.totalItems.toLocaleString()}
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-xs text-[#a5a3c2] whitespace-nowrap">
                  {formatDistanceToNow(new Date(job.updatedAt), { addSuffix: true })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
