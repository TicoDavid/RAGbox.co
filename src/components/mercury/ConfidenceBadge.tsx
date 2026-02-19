'use client'

interface ConfidenceBadgeProps {
  confidence: number
  threshold?: number
}

function getConfidenceColor(confidence: number): {
  bg: string
  text: string
  border: string
} {
  if (confidence >= 0.85) {
    return {
      bg: 'rgba(34, 197, 94, 0.15)',
      text: '#22c55e',
      border: 'rgba(34, 197, 94, 0.3)',
    }
  }
  if (confidence >= 0.70) {
    return {
      bg: 'rgba(245, 158, 11, 0.15)',
      text: '#f59e0b',
      border: 'rgba(245, 158, 11, 0.3)',
    }
  }
  return {
    bg: 'rgba(239, 68, 68, 0.15)',
    text: '#ef4444',
    border: 'rgba(239, 68, 68, 0.3)',
  }
}

export default function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  const percent = (confidence * 100).toFixed(0)
  const color = getConfidenceColor(confidence)

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
      style={{
        backgroundColor: color.bg,
        color: color.text,
        border: `1px solid ${color.border}`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: color.text }}
      />
      {percent}%
    </span>
  )
}
