import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/api'
import { toast } from 'sonner'

export interface RoamGroup {
  id: string
  name: string
  description?: string
  memberCount?: number
}

export interface RoamStatus {
  status: 'connected' | 'disconnected' | 'error'
  workspaceName?: string
  targetGroupName?: string
  targetGroupId?: string
  responseMode?: 'mentions' | 'all' | 'dms_mentions'
  lastWebhook?: string
  messageCount?: number
  connectedAt?: string
  error?: string
}

export function useRoamIntegration() {
  const [roamClientId, setRoamClientId] = useState('')
  const [roamApiKey, setRoamApiKey] = useState('')
  const [roamKeyVisible, setRoamKeyVisible] = useState(false)
  const [roamWebhookSecret, setRoamWebhookSecret] = useState('')
  const [roamSecretVisible, setRoamSecretVisible] = useState(false)
  const [roamResponseMode, setRoamResponseMode] = useState<'mentions' | 'all' | 'dms_mentions'>('mentions')
  const [roamGroups, setRoamGroups] = useState<RoamGroup[]>([])
  const [roamSelectedGroup, setRoamSelectedGroup] = useState('')
  const [roamStatus, setRoamStatus] = useState<RoamStatus>({ status: 'disconnected' })
  const [roamLoadingGroups, setRoamLoadingGroups] = useState(false)
  const [roamTesting, setRoamTesting] = useState(false)
  const [roamTestResult, setRoamTestResult] = useState<{ success: boolean; workspaceName?: string; error?: string } | null>(null)
  const [roamSaving, setRoamSaving] = useState(false)
  const [roamSaveSuccess, setRoamSaveSuccess] = useState(false)
  const [roamDisconnecting, setRoamDisconnecting] = useState(false)
  const [roamError, setRoamError] = useState('')

  // Fetch status on mount
  useEffect(() => {
    async function loadRoamStatus() {
      try {
        const res = await apiFetch('/api/connectors/roam/status')
        if (res.ok) {
          const data = await res.json()
          if (data.data) {
            setRoamStatus(data.data)
            if (data.data.responseMode) setRoamResponseMode(data.data.responseMode)
          }
        }
      } catch {
        // ROAM status not available yet
      }
    }
    loadRoamStatus()
  }, [])

  const fetchRoamGroups = useCallback(async () => {
    if (!roamApiKey.trim()) return
    setRoamLoadingGroups(true)
    try {
      const res = await apiFetch('/api/connectors/roam/groups', {
        headers: { 'X-Roam-Api-Key': roamApiKey },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to fetch groups')
      }
      const data = await res.json()
      const groups = data.data?.groups || data.data || []
      setRoamGroups(groups)
      if (groups.length > 0 && !roamSelectedGroup) {
        setRoamSelectedGroup(groups[0].id)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch groups'
      setRoamError(message)
      setRoamGroups([])
    } finally {
      setRoamLoadingGroups(false)
    }
  }, [roamApiKey, roamSelectedGroup])

  const handleRoamTest = async () => {
    if (!roamApiKey.trim()) {
      toast.error('Enter an API key first')
      return
    }
    setRoamTesting(true)
    setRoamTestResult(null)
    setRoamError('')
    try {
      const res = await apiFetch('/api/connectors/roam/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: roamApiKey }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Connection test failed')
      }
      const result = { success: true, workspaceName: data.data?.workspaceName || data.data?.workspace || 'Connected' }
      setRoamTestResult(result)
      fetchRoamGroups()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection test failed'
      setRoamTestResult({ success: false, error: msg })
      setRoamError(msg)
    } finally {
      setRoamTesting(false)
    }
  }

  const handleRoamSave = async () => {
    if (!roamApiKey.trim()) {
      toast.error('Enter an API key')
      return
    }
    setRoamSaving(true)
    setRoamSaveSuccess(false)
    setRoamError('')
    try {
      const res = await apiFetch('/api/connectors/roam/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: roamClientId,
          apiKey: roamApiKey,
          webhookSecret: roamWebhookSecret,
          targetGroupId: roamSelectedGroup,
          targetGroupName: roamGroups.find((g) => g.id === roamSelectedGroup)?.name || '',
          responseMode: roamResponseMode,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Save failed')
      }
      const data = await res.json()
      setRoamStatus(data.data || {
        status: 'connected',
        workspaceName: roamTestResult?.workspaceName,
        targetGroupName: roamGroups.find((g) => g.id === roamSelectedGroup)?.name,
        responseMode: roamResponseMode,
      })
      setRoamSaveSuccess(true)
      toast.success('ROAM connected successfully')
      setTimeout(() => setRoamSaveSuccess(false), 3000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Save failed'
      setRoamError(msg)
      toast.error(msg)
    } finally {
      setRoamSaving(false)
    }
  }

  const handleRoamDisconnect = async () => {
    setRoamDisconnecting(true)
    try {
      const res = await apiFetch('/api/connectors/roam/uninstall', { method: 'POST' })
      if (!res.ok) throw new Error('Disconnect failed')
      setRoamStatus({ status: 'disconnected' })
      setRoamGroups([])
      setRoamSelectedGroup('')
      setRoamClientId('')
      setRoamApiKey('')
      setRoamWebhookSecret('')
      setRoamTestResult(null)
      toast.success('ROAM disconnected')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to disconnect')
    } finally {
      setRoamDisconnecting(false)
    }
  }

  const resetError = useCallback(() => {
    setRoamStatus({ status: 'disconnected' })
    setRoamError('')
    setRoamTestResult(null)
  }, [])

  return {
    roamClientId, setRoamClientId,
    roamApiKey, setRoamApiKey,
    roamKeyVisible, setRoamKeyVisible,
    roamWebhookSecret, setRoamWebhookSecret,
    roamSecretVisible, setRoamSecretVisible,
    roamResponseMode, setRoamResponseMode,
    roamGroups,
    roamSelectedGroup, setRoamSelectedGroup,
    roamStatus,
    roamLoadingGroups,
    roamTesting,
    roamTestResult,
    roamSaving,
    roamSaveSuccess,
    roamDisconnecting,
    roamError, setRoamError,
    resetError,
    fetchRoamGroups,
    handleRoamTest,
    handleRoamSave,
    handleRoamDisconnect,
  }
}
