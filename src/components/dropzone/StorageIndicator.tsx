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

  const barColor = isCritical ? '#FF3D00' : isWarning ? '#FFAB00' : '#2463EB'

  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-[#888]">Storage</span>
        <span className="text-[10px] text-[#666]">
          {formatBytes(usedBytes)} / {formatBytes(maxBytes)}
        </span>
      </div>
      <div className="w-full h-1.5 bg-[#222] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${percentage}%`,
            backgroundColor: barColor,
            boxShadow: `0 0 6px ${barColor}40`,
          }}
        />
      </div>
    </div>
  )
}
