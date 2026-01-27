'use client'

interface ConfidenceBadgeProps {
  confidence: number
  threshold?: number
}

export default function ConfidenceBadge({ confidence, threshold = 0.85 }: ConfidenceBadgeProps) {
  const isHigh = confidence >= threshold
  const percent = (confidence * 100).toFixed(0)

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{
        backgroundColor: isHigh ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255, 171, 0, 0.15)',
        color: isHigh ? '#22c55e' : '#FFAB00',
        border: `1px solid ${isHigh ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 171, 0, 0.3)'}`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: isHigh ? '#22c55e' : '#FFAB00' }}
      />
      {percent}%
    </span>
  )
}
