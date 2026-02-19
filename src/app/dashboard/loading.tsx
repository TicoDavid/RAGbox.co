export default function DashboardLoading() {
  return (
    <div className="flex flex-1 h-screen bg-[var(--bg-primary)]">
      {/* Left rail skeleton */}
      <div className="w-14 border-r border-[var(--border-subtle)] flex flex-col items-center py-4 gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="w-8 h-8 rounded-lg bg-[var(--border-subtle)] animate-pulse" />
        ))}
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 flex flex-col">
        {/* Header skeleton */}
        <div className="h-14 border-b border-[var(--border-subtle)] flex items-center px-6 gap-4">
          <div className="w-24 h-6 rounded bg-[var(--border-subtle)] animate-pulse" />
          <div className="flex-1" />
          <div className="w-32 h-8 rounded-lg bg-[var(--border-subtle)] animate-pulse" />
          <div className="w-8 h-8 rounded-full bg-[var(--border-subtle)] animate-pulse" />
        </div>

        {/* Content skeleton */}
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-2 border-blue-600/40 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-sm text-[var(--text-tertiary)] font-[family-name:var(--font-jakarta)]">
              Loading dashboard...
            </p>
          </div>
        </div>
      </div>

      {/* Right rail skeleton */}
      <div className="w-14 border-l border-[var(--border-subtle)] flex flex-col items-center py-4 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="w-8 h-8 rounded-lg bg-[var(--border-subtle)] animate-pulse" />
        ))}
      </div>
    </div>
  )
}
