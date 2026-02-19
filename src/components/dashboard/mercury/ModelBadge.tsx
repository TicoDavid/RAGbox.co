interface ModelBadgeProps {
  modelUsed?: string
  provider?: string
  latencyMs?: number
}

export function ModelBadge({ modelUsed, provider, latencyMs }: ModelBadgeProps) {
  if (!modelUsed) return null

  const isAegis = !provider || provider === 'aegis'

  const label = isAegis ? 'AEGIS' : modelUsed
  const emoji = isAegis ? '\u26A1' : '\uD83D\uDD12'

  const colorClass = isAegis
    ? 'bg-[var(--brand-blue)]/10 text-[var(--brand-blue)]'
    : 'bg-[var(--privilege-confidential)]/10 text-[var(--privilege-confidential)]'

  const latencySuffix = latencyMs != null
    ? ` \u00B7 ${(latencyMs / 1000).toFixed(1)}s`
    : ''

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}>
      {emoji} {label}{latencySuffix}
    </span>
  )
}
