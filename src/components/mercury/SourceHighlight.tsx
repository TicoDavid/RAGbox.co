'use client'

interface SourceHighlightProps {
  text: string
  isHighlighted: boolean
  citationIndex?: number
}

export default function SourceHighlight({ text, isHighlighted, citationIndex }: SourceHighlightProps) {
  if (!isHighlighted) {
    return <span className="text-[#888] text-xs">{text}</span>
  }

  return (
    <span
      className="relative text-xs px-1 py-0.5 rounded"
      style={{
        backgroundColor: 'rgba(36, 99, 235, 0.08)',
        borderLeft: '2px solid #2463EB',
        boxShadow: '0 0 12px rgba(36, 99, 235, 0.15)',
      }}
    >
      {citationIndex && (
        <span className="absolute -top-2 -left-1 text-[8px] font-bold text-[#2463EB]">
          [{citationIndex}]
        </span>
      )}
      <span className="text-[#ccc]">{text}</span>
    </span>
  )
}
