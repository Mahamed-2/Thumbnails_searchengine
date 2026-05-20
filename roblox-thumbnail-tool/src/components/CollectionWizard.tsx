'use client';

// =============================================================================
// src/components/CollectionWizard.tsx — New Collection Job form modal
// =============================================================================

import { X, Play } from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

import { createCollectionJob } from '@/lib/api-client';


interface CollectionWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CollectionWizard({ isOpen, onClose, onSuccess }: CollectionWizardProps) {
  const [strategy, setStrategy] = useState<'user-range' | 'game-search' | 'popular-games'>('user-range');
  const [isLoading, setIsLoading] = useState(false);

  // Form states
  const [startUserId, setStartUserId] = useState('1');
  const [endUserId, setEndUserId] = useState('100');
  const [keyword, setKeyword] = useState('');
  const [limit, setLimit] = useState('100');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (strategy === 'user-range') {
        await createCollectionJob({
          strategy: 'user-range',
          startUserId: parseInt(startUserId, 10),
          endUserId: parseInt(endUserId, 10),
          batchSize: 100,
          sizes: ['420x420'],
          cropTypes: ['avatar'],
          format: 'png',
          downloadImages: true,
        });
      } else if (strategy === 'game-search') {
        await createCollectionJob({
          strategy: 'game-search',
          keyword,
          limit: parseInt(limit, 10),
          sizes: ['512x512'],
          downloadImages: true,
        });
      } else if (strategy === 'popular-games') {
        await createCollectionJob({
          strategy: 'popular-games',
          limit: parseInt(limit, 10),
          sizes: ['512x512'],
          downloadImages: true,
        });
      }
      
      toast.success('Collection job queued successfully');
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start job');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-[var(--bg-elevated)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
          <h2 className="text-lg font-semibold text-white">New Collection Job</h2>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-[#a5a3c2] hover:text-white hover:bg-[var(--bg-surface)] transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-[#a5a3c2]">Strategy</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'user-range', label: 'User Range' },
                { id: 'game-search', label: 'Game Search' },
                { id: 'popular-games', label: 'Popular Games' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStrategy(s.id as 'user-range' | 'game-search' | 'popular-games')}
                  className={`py-2 px-3 text-xs rounded-lg transition-all border ${
                    strategy === s.id 
                      ? 'bg-[var(--primary-600)] border-[var(--primary-400)] text-white shadow-[0_0_15px_rgba(99,102,241,0.3)]'
                      : 'bg-[var(--bg-surface)] border-transparent text-[#a5a3c2] hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {strategy === 'user-range' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs text-[#a5a3c2]">Start User ID</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={startUserId}
                    onChange={(e) => setStartUserId(e.target.value)}
                    className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[var(--primary-400)] text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs text-[#a5a3c2]">End User ID</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={endUserId}
                    onChange={(e) => setEndUserId(e.target.value)}
                    className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[var(--primary-400)] text-sm"
                  />
                </div>
              </div>
            )}

            {strategy === 'game-search' && (
              <div className="space-y-1.5">
                <label className="block text-xs text-[#a5a3c2]">Search Keyword</label>
                <input
                  type="text"
                  required
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="e.g., obby, simulator"
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[var(--primary-400)] text-sm"
                />
              </div>
            )}

            {(strategy === 'game-search' || strategy === 'popular-games') && (
              <div className="space-y-1.5">
                <label className="block text-xs text-[#a5a3c2]">Limit</label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  required
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  className="w-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg px-3 py-2 text-white focus:outline-none focus:border-[var(--primary-400)] text-sm"
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full btn btn-primary flex justify-center items-center gap-2"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <Play size={16} fill="currentColor" />
                <span>Start Collection</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
