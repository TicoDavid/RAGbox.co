'use client'

interface SourceHighlightProps {
  text: string
  isHighlighted: boolean
  citationIndex?: number
}

export default function SourceHighlight({ text, isHighlighted, citationIndex }: SourceHighlightProps) {
  if (!isHighlighted) {
    return <span className="text-[var(--text-tertiary)] text-xs">{text}</span>
  }

  return (
    <span
      className="relative text-xs px-1 py-0.5 rounded"
      style={{
        backgroundColor: 'rgba(var(--brand-blue-rgb, 0, 240, 255), 0.08)',
        borderLeft: '2px solid var(--brand-blue)',
        boxShadow: '0 0 12px rgba(var(--brand-blue-rgb, 0, 240, 255), 0.15)',
      }}
    >
      {citationIndex && (
        <span className="absolute -top-2 -left-1 text-[8px] font-bold text-[var(--brand-blue)]">
          [{citationIndex}]
        </span>
      )}
      <span className="text-[var(--text-secondary)]">{text}</span>
    </span>
  )
}
