export default function Analytics() {
  return (
    <div className="animate-fade-in">
      <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Analytics</h1>
      <p className="text-text-muted mb-8">Performance metrics and data distribution.</p>
      
      <div className="flex flex-col items-center justify-center h-[60vh] border border-dashed border-surface-700 rounded-2xl bg-surface-800/20">
        <h3 className="text-xl font-medium text-white mb-2">Coming Soon</h3>
        <p className="text-text-muted text-center max-w-md">
          Recharts integration for queue throughput, duplicate ratios, and storage usage will be implemented here.
        </p>
      </div>
    </div>
  );
}
