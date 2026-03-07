'use client'

import { useState, useCallback, useEffect } from 'react'

type DotStatus = 'connected' | 'error' | 'hidden'

export function IntegrationStatusDots() {
  const [roam, setRoam] = useState<DotStatus>('hidden')
  const [whatsapp, setWhatsapp] = useState<DotStatus>('hidden')
  const [loaded, setLoaded] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const [roamRes, waRes] = await Promise.allSettled([
        fetch('/api/integrations/roam/status'),
        fetch('/api/settings/integrations'),
      ])

      // ROAM status
      if (roamRes.status === 'fulfilled' && roamRes.value.ok) {
        const { data } = await roamRes.value.json()
        if (data?.status === 'connected' || data?.healthStatus === 'healthy') {
          setRoam('connected')
        } else if (data?.status === 'error' || data?.healthStatus === 'error') {
          setRoam('error')
        } else {
          setRoam('hidden')
        }
      }

      // WhatsApp — derive from integration settings
      if (waRes.status === 'fulfilled' && waRes.value.ok) {
        const { data } = await waRes.value.json()
        if (data?.whatsappEnabled) {
          setWhatsapp('connected')
        } else {
          setWhatsapp('hidden')
        }
      }
    } catch {
      // Silent — dots just stay hidden
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 60_000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  if (!loaded) return null
  if (roam === 'hidden' && whatsapp === 'hidden') return null

  return (
    <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-[var(--bg-elevated)]/20 border border-[var(--border-subtle)]">
      {roam !== 'hidden' && (
        <div className="flex items-center gap-1" title={roam === 'connected' ? 'ROAM connected' : 'ROAM error'}>
          <span className={`w-1.5 h-1.5 rounded-full ${roam === 'connected' ? 'bg-[var(--success)] animate-pulse' : 'bg-[var(--danger)]'}`} />
          <span className="text-[10px] font-medium text-[var(--text-tertiary)]">ROAM</span>
        </div>
      )}
      {whatsapp !== 'hidden' && (
        <div className="flex items-center gap-1" title={whatsapp === 'connected' ? 'WhatsApp connected' : 'WhatsApp error'}>
          <span className={`w-1.5 h-1.5 rounded-full ${whatsapp === 'connected' ? 'bg-[#25D366] animate-pulse' : 'bg-[var(--danger)]'}`} />
          <span className="text-[10px] font-medium text-[var(--text-tertiary)]">WhatsApp</span>
        </div>
      )}
    </div>
  )
}
