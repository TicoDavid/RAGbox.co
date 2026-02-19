'use client'

interface StorageIndicatorProps {
  usedBytes: number
  maxBytes: number
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export default function StorageIndicator({ usedBytes, maxBytes }: StorageIndicatorProps) {
  const percentage = Math.min((usedBytes / maxBytes) * 100, 100)
  const isWarning = percentage > 80
  const isCritical = percentage > 95

  const barColor = isCritical ? 'var(--danger)' : isWarning ? 'var(--warning)' : 'var(--brand-blue)'

  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-[var(--text-tertiary)]">Storage</span>
        <span className="text-[10px] text-[var(--text-tertiary)]">
          {formatBytes(usedBytes)} / {formatBytes(maxBytes)}
        </span>
      </div>
      <div className="w-full h-1.5 bg-[var(--bg-tertiary)] rounded-full overflow-hidden" role="progressbar" aria-valuenow={Math.round(percentage)} aria-valuemin={0} aria-valuemax={100} aria-label="Storage usage">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${percentage}%`,
            backgroundColor: barColor,
            boxShadow: `0 0 6px ${barColor}`,
          }}
        />
      </div>
    </div>
  )
}
