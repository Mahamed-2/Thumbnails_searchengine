'use client';

// =============================================================================
// src/app/page.tsx — Main Dashboard View
// =============================================================================

import { Activity, Image as ImageIcon, Plus, Database } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';

import { CollectionWizard } from '@/components/CollectionWizard';
import { JobsTable } from '@/components/JobsTable';
import { StatsCard } from '@/components/StatsCard';
import { ThumbnailGrid } from '@/components/ThumbnailGrid';
import { fetchDashboardStats, fetchThumbnails } from '@/lib/api-client';
import type { DashboardStats, Thumbnail } from '@/types';


export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [thumbnails, setThumbnails] = useState<Thumbnail[]>([]);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [isThumbnailsLoading, setIsThumbnailsLoading] = useState(true);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const loadData = async () => {
    try {
      setIsStatsLoading(true);
      const data = await fetchDashboardStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setIsStatsLoading(false);
    }

    try {
      setIsThumbnailsLoading(true);
      const res = await fetchThumbnails({ limit: 12 });
      setThumbnails(res.data);
    } catch (err) {
      console.error('Failed to load thumbnails:', err);
    } finally {
      setIsThumbnailsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Poll for updates every 15 seconds
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen bg-[var(--bg-primary)] p-4 md:p-8 text-white selection:bg-[var(--primary-500)] selection:text-white">
      <Toaster position="top-right" toastOptions={{
        className: 'bg-[var(--bg-elevated)] text-white border border-[var(--border)]',
        style: { background: 'var(--bg-elevated)', color: '#fff' }
      }} />
      
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight gradient-text">Roblox Thumbnail Engine</h1>
            <p className="text-sm text-[#a5a3c2] mt-1">Real-time dataset collection and processing overview</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="btn btn-secondary border border-[var(--border)] flex items-center gap-2">
              <Database size={16} />
              <span>Export</span>
            </button>
            <button 
              onClick={() => setIsWizardOpen(true)}
              className="btn btn-primary flex items-center gap-2 shadow-[0_0_20px_rgba(99,102,241,0.4)]"
            >
              <Plus size={16} />
              <span>New Job</span>
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <StatsCard 
            label="Total Thumbnails" 
            value={stats?.thumbnails.total ?? 0}
            icon="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
            color="primary"
          />
          <StatsCard 
            label="Unique Users" 
            value={stats?.thumbnails.uniqueUsers ?? 0}
            icon="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" 
            color="success"
          />
          <StatsCard 
            label="Active Jobs" 
            value={(stats?.jobs.byStatus['running'] ?? 0) + (stats?.jobs.byStatus['pending'] ?? 0)}
            icon="M13 10V3L4 14h7v7l9-11h-7z" 
            color="warning"
          />
          <StatsCard 
            label="Completed Jobs" 
            value={stats?.jobs.byStatus['completed'] ?? 0}
            icon="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
            color="info"
          />
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <ImageIcon className="text-[var(--primary-400)]" size={20} />
                Recent Thumbnails
              </h2>
            </div>
            <ThumbnailGrid thumbnails={thumbnails} isLoading={isThumbnailsLoading} />
          </div>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Activity className="text-[var(--accent-400)]" size={20} />
                Activity Feed
              </h2>
            </div>
            <JobsTable jobs={stats?.recentActivity ?? []} isLoading={isStatsLoading} />
          </div>
        </div>
      </div>

      <CollectionWizard 
        isOpen={isWizardOpen} 
        onClose={() => setIsWizardOpen(false)} 
        onSuccess={loadData}
      />
    </main>
  );
}
