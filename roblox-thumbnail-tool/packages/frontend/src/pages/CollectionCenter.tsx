import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Progress } from '../components/ui/Progress';
import { api } from '../lib/api';
import { useSSE } from '../hooks/useSSE';

export default function CollectionCenter() {
  const queryClient = useQueryClient();
  const [strategy, setStrategy] = useState<'user-range' | 'game-search' | 'popular-games'>('user-range');
  const [startId, setStartId] = useState(1);
  const [endId, setEndId] = useState(1000);
  
  // Real-time events connection
  useSSE({ url: '/api/v1/events/all' });

  // Fetch recent jobs
  const { data: jobsResponse, isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => api.get('/jobs?limit=5').then((res: any) => res.data),
    refetchInterval: 3000, // Poll slightly in addition to SSE just in case
  });

  const jobs = jobsResponse?.jobs || [];

  const createJobMutation = useMutation({
    mutationFn: (jobData: any) => api.post('/jobs', jobData),
    onSuccess: () => {
      toast.success('Collection job queued successfully');
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['systemStats'] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    createJobMutation.mutate({
      type: 'thumbnail-collection',
      strategy,
      startUserId: startId,
      endUserId: endId,
      size: '150x150',
      cropType: 'headshot',
      format: 'png',
      downloadImages: true,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge variant="info">Active</Badge>;
      case 'completed': return <Badge variant="success">Completed</Badge>;
      case 'failed': return <Badge variant="danger">Failed</Badge>;
      case 'waiting': return <Badge variant="warning">Waiting</Badge>;
      case 'cancelled': return <Badge variant="default">Cancelled</Badge>;
      default: return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Collection Center</h1>
        <p className="text-text-muted">Launch and monitor background thumbnail collection jobs.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Wizard Form */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>New Collection Job</CardTitle>
            <CardDescription>Configure target parameters</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleStart} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Strategy</label>
                <select 
                  className="w-full bg-surface-900 border border-surface-600 rounded-lg p-2 text-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                  value={strategy}
                  onChange={(e: any) => setStrategy(e.target.value)}
                >
                  <option value="user-range">User ID Range</option>
                  <option value="popular-games">Popular Games (Top 100)</option>
                </select>
              </div>

              {strategy === 'user-range' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Start ID</label>
                    <input 
                      type="number" 
                      min="1"
                      className="w-full bg-surface-900 border border-surface-600 rounded-lg p-2 text-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      value={startId}
                      onChange={(e) => setStartId(parseInt(e.target.value) || 1)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">End ID</label>
                    <input 
                      type="number" 
                      min="1"
                      className="w-full bg-surface-900 border border-surface-600 rounded-lg p-2 text-white focus:ring-2 focus:ring-primary-500 focus:outline-none"
                      value={endId}
                      onChange={(e) => setEndId(parseInt(e.target.value) || 1)}
                    />
                  </div>
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full mt-4" 
                isLoading={createJobMutation.isPending}
              >
                <Play className="w-4 h-4 mr-2" />
                Start Collection
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Active Jobs Grid */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Job Queue</CardTitle>
            <CardDescription>Currently running and recent jobs</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center p-8"><RefreshCw className="animate-spin text-surface-500" /></div>
            ) : jobs.length === 0 ? (
              <div className="text-center p-8 border border-dashed border-surface-600 rounded-xl">
                <AlertCircle className="mx-auto h-8 w-8 text-surface-500 mb-2" />
                <p className="text-surface-400">No recent jobs found.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {jobs.map((job: any) => {
                  const progress = job.progress ? (typeof job.progress === 'string' ? JSON.parse(job.progress) : job.progress) : null;
                  const pct = progress?.percentage || 0;
                  
                  return (
                    <div key={job.id} className="p-4 bg-surface-900 rounded-xl border border-surface-700">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="font-semibold">{job.strategy}</h4>
                          <p className="text-xs text-text-muted mt-1">Job ID: {job.id}</p>
                        </div>
                        {getStatusBadge(job.status)}
                      </div>
                      
                      {job.status === 'active' && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs text-text-muted">
                            <span>{progress?.phase || 'initializing'}</span>
                            <span>{pct}%</span>
                          </div>
                          <Progress value={pct} />
                          <div className="flex justify-between text-xs text-text-muted pt-1">
                            <span>{progress?.processed || 0} processed</span>
                            <span>{progress?.successful || 0} saved</span>
                          </div>
                        </div>
                      )}
                      
                      {job.status === 'failed' && (
                        <p className="text-sm text-red-400 mt-2 bg-red-900/10 p-2 rounded">
                          {job.error || 'Unknown error occurred'}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
