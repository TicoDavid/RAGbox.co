'use client'

import { useState, useCallback } from 'react'

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [text])

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 px-2 py-1 text-[10px] font-mono rounded
        bg-[var(--bg-elevated)] text-[var(--text-tertiary)]
        hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]
        transition-all opacity-0 group-hover:opacity-100"
      aria-label="Copy code"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}
