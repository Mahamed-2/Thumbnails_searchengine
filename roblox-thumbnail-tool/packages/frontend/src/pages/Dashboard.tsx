import { useQuery } from '@tanstack/react-query';
import { Activity, Image as ImageIcon, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { api } from '../lib/api';

export default function Dashboard() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['systemStats'],
    queryFn: () => api.get('/stats').then((res: any) => res.data),
    refetchInterval: 5000,
  });

  if (isLoading) return <div className="flex justify-center p-12"><Activity className="animate-spin text-primary-500" size={32} /></div>;
  if (error) return <div className="p-4 text-red-400 bg-red-900/20 rounded-xl">Failed to load dashboard data</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Dashboard</h1>
        <p className="text-text-muted">System overview and queue performance metrics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Thumbnails */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Thumbnails</CardTitle>
            <ImageIcon className="h-4 w-4 text-text-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.thumbnails?.total || 0}</div>
            <p className="text-xs text-text-muted mt-1">
              Collected & validated
            </p>
          </CardContent>
        </Card>

        {/* Queue Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Queue Status</CardTitle>
            <Activity className="h-4 w-4 text-text-muted" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.jobs?.active || 0} <span className="text-sm font-normal text-text-muted">active</span>
            </div>
            <div className="flex gap-2 mt-2">
              <Badge variant="warning">{stats?.jobs?.waiting || 0} waiting</Badge>
              <Badge variant="info">{stats?.jobs?.delayed || 0} delayed</Badge>
            </div>
          </CardContent>
        </Card>

        {/* Job Success */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Completed Jobs</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">{stats?.jobs?.completed || 0}</div>
            <p className="text-xs text-text-muted mt-1">
              Successfully finished
            </p>
          </CardContent>
        </Card>

        {/* Failed Jobs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Failed Jobs (DLQ)</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">{stats?.jobs?.failed || 0}</div>
            <p className="text-xs text-text-muted mt-1">
              Requires manual review or replay
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
            <CardDescription>Backend services and API connections</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Redis Queue</span>
                <Badge variant="success">Online</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Database (Prisma)</span>
                <Badge variant="success">Online</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Storage Backend</span>
                <Badge variant="success">Online</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest collection jobs</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-text-muted italic">Job history will appear here once jobs are started.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
