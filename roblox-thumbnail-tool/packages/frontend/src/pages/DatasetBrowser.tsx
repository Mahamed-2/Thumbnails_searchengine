import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Search, Filter, Image as ImageIcon, Download } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { api } from '../lib/api';

export default function DatasetBrowser() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  
  const { data, isLoading } = useQuery<any>({
    queryKey: ['thumbnails', page, search],
    queryFn: () => api.get(`/thumbnails?page=${page}&limit=24${search ? `&userId=${search}` : ''}`).then((res: any) => res.data),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-6 animate-fade-in flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Dataset Browser</h1>
          <p className="text-text-muted">Explore collected thumbnails and identify duplicates.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 w-4 h-4" />
            <input 
              type="text" 
              placeholder="Search User ID..."
              className="pl-9 pr-4 py-2 bg-surface-900 border border-surface-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500 w-64"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="secondary" className="px-3">
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>
          <Button variant="secondary" className="px-3">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 pr-2 custom-scrollbar">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="aspect-square bg-surface-800 animate-pulse rounded-xl" />
            ))}
          </div>
        ) : data?.data?.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full border border-dashed border-surface-700 rounded-2xl bg-surface-800/20">
            <ImageIcon className="w-12 h-12 text-surface-500 mb-4" />
            <h3 className="text-lg font-medium text-white mb-1">No thumbnails found</h3>
            <p className="text-text-muted">Adjust your search or run a collection job.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
            {data?.data?.map((thumb: any) => (
              <Card key={thumb.id} className="overflow-hidden group hover:border-primary-500/50 transition-colors">
                <div className="aspect-square relative bg-surface-900">
                  <img 
                    src={thumb.cloudUrl || thumb.imageUrl} 
                    alt={`User ${thumb.userId}`}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    loading="lazy"
                  />
                  {thumb.isDuplicate && (
                    <div className="absolute top-2 right-2">
                      <Badge variant="warning" className="shadow-lg backdrop-blur-md bg-yellow-500/80 text-yellow-950 border-none">Dup</Badge>
                    </div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-xs text-white truncate font-medium">{thumb.userId}</p>
                    <p className="text-[10px] text-surface-300">{thumb.size} • {thumb.format}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-surface-700 pt-4 mt-auto">
        <p className="text-sm text-text-muted">
          Showing {data?.data?.length || 0} of {data?.meta?.total || 0} thumbnails
        </p>
        <div className="flex gap-2">
          <Button 
            variant="secondary" 
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <Button 
            variant="secondary" 
            size="sm"
            disabled={page >= (data?.meta?.pages || 1)}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
