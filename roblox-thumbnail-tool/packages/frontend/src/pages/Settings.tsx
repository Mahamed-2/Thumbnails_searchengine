import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export default function Settings() {
  return (
    <div className="animate-fade-in space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Settings</h1>
        <p className="text-text-muted">Manage system configuration and exports.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Storage Configuration</CardTitle>
          <CardDescription>Currently active storage adapters</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-surface-900 rounded-lg border border-surface-700">
              <div>
                <h4 className="font-medium text-white">Local Storage</h4>
                <p className="text-sm text-text-muted">/data/images</p>
              </div>
              <div className="h-3 w-3 bg-green-500 rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
            </div>
            
            <div className="flex justify-between items-center p-4 bg-surface-900 rounded-lg border border-surface-700 opacity-50 grayscale">
              <div>
                <h4 className="font-medium text-white">Supabase Integration</h4>
                <p className="text-sm text-text-muted">Not configured</p>
              </div>
              <Button variant="secondary" size="sm">Configure</Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card border-red-500>
        <CardHeader>
          <CardTitle className="text-red-400">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center">
            <div>
              <h4 className="font-medium text-white">Purge Dataset</h4>
              <p className="text-sm text-text-muted mt-1">Permanently delete all collected thumbnails and clear the queue.</p>
            </div>
            <Button variant="danger">Purge Data</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
