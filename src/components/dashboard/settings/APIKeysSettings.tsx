'use client'

import React, { useState } from 'react'
import { useSettings, type CachedModel } from '@/contexts/SettingsContext'
import { OPENROUTER_ENDPOINT } from '@/services/OpenRouterService'

// Connection type icons
const CONNECTION_ICONS: Record<string, React.ReactNode> = {
  openrouter: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
  openai: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364l2.0201-1.1638a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/></svg>,
  anthropic: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.304 3h-3.513l6.21 18h3.513l-6.21-18zM6.696 3H3.183l6.21 18h3.513L6.696 3z"/></svg>,
  google: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>,
  local: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><circle cx="6" cy="6" r="1" fill="currentColor"/><circle cx="6" cy="18" r="1" fill="currentColor"/></svg>,
  custom: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>,
}

type ProviderPreset = 'openrouter' | 'openai' | 'custom'

const PROVIDER_PRESETS: { id: ProviderPreset; name: string; description: string; endpoint: string; recommended?: boolean }[] = [
  { id: 'openrouter', name: 'OpenRouter', description: 'Access 100+ models via single key', endpoint: OPENROUTER_ENDPOINT, recommended: true },
  { id: 'openai', name: 'OpenAI Direct', description: 'Direct OpenAI API connection', endpoint: 'https://api.openai.com/v1' },
  { id: 'custom', name: 'Custom / Local', description: 'Self-hosted or other providers', endpoint: '' },
]

export function APIKeysSettings() {
  const { connections, addConnection, updateConnection, deleteConnection, verifyConnection, setConnectionModel, isVerifying } = useSettings()
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<ProviderPreset>('openrouter')
  const [formData, setFormData] = useState({ name: '', endpoint: '', apiKey: '' })
  const [fetchingModels, setFetchingModels] = useState<string | null>(null)
  const [modelError, setModelError] = useState<string | null>(null)

  const currentPreset = PROVIDER_PRESETS.find(p => p.id === selectedProvider)

  const handleProviderChange = (providerId: ProviderPreset) => {
    setSelectedProvider(providerId)
    const preset = PROVIDER_PRESETS.find(p => p.id === providerId)
    if (preset && preset.endpoint) {
      setFormData(prev => ({
        ...prev,
        endpoint: preset.endpoint,
        name: preset.name === 'OpenRouter' ? 'OpenRouter Gateway' : prev.name
      }))
    } else {
      setFormData(prev => ({ ...prev, endpoint: '' }))
    }
    setModelError(null)
  }

  const handleOpenRouterVerify = async (connectionId: string, apiKey: string) => {
    setFetchingModels(connectionId)
    setModelError(null)

    try {
      const res = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      })

      const result = await res.json()

      if (!result.success) {
        setModelError(result.error || 'Verification failed')
        updateConnection(connectionId, { verified: false })
        return false
      }

      const cachedModels: CachedModel[] = (result.models || []).slice(0, 500).map((m: { id: string; name: string; context_length: number }) => ({
        id: m.id,
        name: m.name,
        contextLength: m.context_length
      }))

      updateConnection(connectionId, {
        verified: true,
        availableModels: cachedModels,
        selectedModel: cachedModels[0]?.id
      })

      return true
    } catch {
      setModelError('Network error')
      return false
    } finally {
      setFetchingModels(null)
    }
  }

  const handleAddConnection = async () => {
    if (!formData.apiKey) return

    const endpoint = selectedProvider === 'custom' ? formData.endpoint : (currentPreset?.endpoint || formData.endpoint)
    const name = formData.name || currentPreset?.name || 'Custom Connection'

    if (!endpoint) return

    const conn = await addConnection({
      name,
      endpoint,
      apiKey: formData.apiKey,
      type: selectedProvider === 'openrouter' ? 'openrouter' : selectedProvider === 'openai' ? 'openai' : 'custom',
    })

    if (selectedProvider === 'openrouter') {
      await handleOpenRouterVerify(conn.id, formData.apiKey)
    } else {
      await verifyConnection(conn.id)
    }

    setFormData({ name: '', endpoint: '', apiKey: '' })
    setShowAddForm(false)
    setSelectedProvider('openrouter')
  }

  const handleUpdateConnection = async (id: string) => {
    const conn = connections.find(c => c.id === id)
    updateConnection(id, formData)

    if (conn?.type === 'openrouter') {
      await handleOpenRouterVerify(id, formData.apiKey)
    } else {
      await verifyConnection(id)
    }

    setEditingId(null)
    setFormData({ name: '', endpoint: '', apiKey: '' })
  }

  const startEditing = (conn: typeof connections[0]) => {
    setEditingId(conn.id)
    setFormData({ name: conn.name, endpoint: conn.endpoint, apiKey: conn.apiKey })
  }

  const truncateUrl = (url: string) => {
    try {
      const parsed = new URL(url)
      return parsed.hostname.length > 20 ? parsed.hostname.slice(0, 20) + '...' : parsed.hostname
    } catch {
      return url.slice(0, 25) + '...'
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Secure Uplinks</h3>
        <p className="text-xs text-[var(--text-secondary)]">
          Configure AI model connections. OpenRouter recommended for multi-model access.
        </p>
      </div>

      {/* Active Connections List */}
      <div className="space-y-3">
        {connections.length === 0 && !showAddForm && (
          <div className="p-8 border border-dashed border-[var(--border-default)] rounded-xl text-center">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-3 text-[var(--text-tertiary)]">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
            <p className="text-sm text-[var(--text-secondary)] mb-1">No Sovereign Gateway Configured</p>
            <p className="text-xs text-[var(--text-tertiary)]">Add OpenRouter to access 100+ AI models</p>
          </div>
        )}

        {connections.map((conn) => (
          <div
            key={conn.id}
            className={`p-4 bg-[var(--bg-tertiary)] border rounded-xl ${
              conn.type === 'openrouter' && conn.verified
                ? 'border-[var(--brand-blue)]/30 shadow-[0_0_15px_-5px_rgba(0,200,255,0.2)]'
                : 'border-[var(--border-default)]'
            }`}
          >
            {editingId === conn.id ? (
              /* Edit Mode */
              <div className="space-y-3">
                <input
                  id="edit-conn-name"
                  name="edit-conn-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Connection Name"
                  className="w-full px-3 py-2 bg-[var(--bg-primary)]/50 border border-[var(--border-default)]/50 rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--brand-blue)]"
                />
                <input
                  id="edit-conn-endpoint"
                  name="edit-conn-endpoint"
                  type="text"
                  value={formData.endpoint}
                  onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                  placeholder="Endpoint URL"
                  disabled={conn.type === 'openrouter'}
                  className="w-full px-3 py-2 bg-[var(--bg-primary)]/50 border border-[var(--border-default)]/50 rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--brand-blue)] disabled:opacity-50"
                />
                <input
                  id="edit-conn-apikey"
                  name="edit-conn-apikey"
                  type="password"
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder="API Key"
                  className="w-full px-3 py-2 bg-[var(--bg-primary)]/50 border border-[var(--border-default)]/50 rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--brand-blue)]"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdateConnection(conn.id)}
                    disabled={isVerifying === conn.id || fetchingModels === conn.id}
                    className="flex-1 px-4 py-2 bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] text-[var(--text-primary)] text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {(isVerifying === conn.id || fetchingModels === conn.id) ? (
                      <>
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        {conn.type === 'openrouter' ? 'Fetching Models...' : 'Testing...'}
                      </>
                    ) : conn.type === 'openrouter' ? 'Test & Fetch Models' : 'Test & Save'}
                  </button>
                  <button
                    onClick={() => { setEditingId(null); setFormData({ name: '', endpoint: '', apiKey: '' }) }}
                    className="px-4 py-2 bg-[var(--bg-tertiary)]hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] text-sm rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* View Mode */
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  {/* Icon */}
                  <div className={`p-2.5 rounded-lg ${
                    conn.type === 'openrouter'
                      ? 'bg-gradient-to-br from-[var(--brand-blue)]/20 to-[var(--brand-blue)]/10 text-[var(--brand-blue)]'
                      : 'bg-[var(--bg-elevated)]/30 text-[var(--text-secondary)]'
                  }`}>
                    {CONNECTION_ICONS[conn.type] || CONNECTION_ICONS.custom}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">{conn.name}</p>
                      {conn.verified ? (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 bg-[var(--success)]/15 text-[var(--success)] rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
                          {conn.type === 'openrouter' ? `${conn.availableModels?.length || 0} models` : 'Verified'}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 bg-[var(--warning)]/10 text-[var(--warning)] rounded-full">Unverified</span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-tertiary)] truncate">{truncateUrl(conn.endpoint)}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => conn.type === 'openrouter' ? handleOpenRouterVerify(conn.id, conn.apiKey) : verifyConnection(conn.id)}
                      disabled={isVerifying === conn.id || fetchingModels === conn.id}
                      className="p-2 text-[var(--text-secondary)] hover:text-[var(--brand-blue)] hover:bg-[var(--bg-elevated)]/30 rounded-lg transition-colors"
                      title={conn.type === 'openrouter' ? 'Refresh Models' : 'Verify'}
                    >
                      {(isVerifying === conn.id || fetchingModels === conn.id) ? (
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                      )}
                    </button>
                    <button
                      onClick={() => startEditing(conn)}
                      className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/30 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>
                    <button
                      onClick={() => deleteConnection(conn.id)}
                      className="p-2 text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                  </div>
                </div>

                {/* Model Selector for OpenRouter */}
                {conn.type === 'openrouter' && conn.verified && conn.availableModels && conn.availableModels.length > 0 && (
                  <div className="pt-3 border-t border-[var(--border-subtle)]">
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">Active Model</label>
                    <select
                      id={`conn-model-${conn.id}`}
                      name={`conn-model-${conn.id}`}
                      value={conn.selectedModel || ''}
                      onChange={(e) => setConnectionModel(conn.id, e.target.value)}
                      className="w-full px-3 py-2.5 bg-[var(--bg-primary)]/50 border border-[var(--border-default)]/50 rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-blue)] appearance-none cursor-pointer"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                    >
                      {conn.availableModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name} ({Math.round(model.contextLength / 1000)}K context)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Connection Form */}
      {showAddForm ? (
        <div className="p-4 bg-[var(--bg-tertiary)] border border-[var(--brand-blue)]/30 rounded-xl space-y-4">
          <p className="text-sm font-medium text-[var(--text-primary)]">New Gateway Connection</p>

          {/* Provider Selection */}
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-2">Provider</label>
            <div className="grid grid-cols-3 gap-2">
              {PROVIDER_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleProviderChange(preset.id)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    selectedProvider === preset.id
                      ? 'border-[var(--brand-blue)] bg-[var(--brand-blue)]/10 shadow-[0_0_15px_-5px_var(--brand-blue)]'
                      : 'border-[var(--border-default)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-elevated)]/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={selectedProvider === preset.id ? 'text-[var(--brand-blue)]' : 'text-[var(--text-secondary)]'}>
                      {CONNECTION_ICONS[preset.id] || CONNECTION_ICONS.custom}
                    </span>
                    <span className={`text-sm font-medium ${selectedProvider === preset.id ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                      {preset.name}
                    </span>
                    {preset.recommended && (
                      <span className="ml-auto text-[9px] px-1.5 py-0.5 bg-[var(--brand-blue)]/20 text-[var(--brand-blue)] rounded font-medium">REC</span>
                    )}
                  </div>
                  <p className="text-[10px] text-[var(--text-tertiary)]">{preset.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Connection Name (for custom) */}
          {selectedProvider === 'custom' && (
            <input
              id="add-conn-name"
              name="add-conn-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Connection Name"
              className="w-full px-3 py-2.5 bg-[var(--bg-primary)]/50 border border-[var(--border-default)]/50 rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--brand-blue)]"
            />
          )}

          {/* Endpoint URL */}
          <div>
            <label htmlFor="add-conn-endpoint" className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">Endpoint URL</label>
            <input
              id="add-conn-endpoint"
              name="add-conn-endpoint"
              type="text"
              value={selectedProvider === 'custom' ? formData.endpoint : (currentPreset?.endpoint || '')}
              onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
              placeholder="https://api.example.com/v1"
              disabled={selectedProvider !== 'custom'}
              className="w-full px-3 py-2.5 bg-[var(--bg-primary)]/50 border border-[var(--border-default)]/50 rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--brand-blue)] disabled:opacity-60 disabled:cursor-not-allowed"
            />
            {selectedProvider !== 'custom' && (
              <p className="text-[10px] text-[var(--text-tertiary)] mt-1 flex items-center gap-1">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Endpoint locked for {currentPreset?.name}
              </p>
            )}
          </div>

          {/* API Key */}
          <div>
            <label htmlFor="add-conn-apikey" className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">API Key</label>
            <input
              id="add-conn-apikey"
              name="add-conn-apikey"
              type="password"
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              placeholder={selectedProvider === 'openrouter' ? 'sk-or-v1-...' : 'sk-...'}
              className="w-full px-3 py-2.5 bg-[var(--bg-primary)]/50 border border-[var(--border-default)]/50 rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--brand-blue)]"
            />
          </div>

          {/* Error Message */}
          {modelError && (
            <div className="p-3 bg-[var(--danger)]/10 border border-[var(--danger)]/30 rounded-lg text-sm text-[var(--danger)]">
              {modelError}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={handleAddConnection}
              disabled={!formData.apiKey || (selectedProvider === 'custom' && !formData.endpoint) || isVerifying !== null || fetchingModels !== null}
              className="flex-1 px-4 py-2.5 bg-[var(--brand-blue)] hover:bg-[var(--brand-blue-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text-primary)] text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {(isVerifying || fetchingModels) ? (
                <>
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {selectedProvider === 'openrouter' ? 'Connecting & Fetching Models...' : 'Testing Connection...'}
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  {selectedProvider === 'openrouter' ? 'Test & Fetch Models' : 'Test & Save'}
                </>
              )}
            </button>
            <button
              onClick={() => { setShowAddForm(false); setFormData({ name: '', endpoint: '', apiKey: '' }); setModelError(null) }}
              className="px-4 py-2.5 bg-[var(--bg-tertiary)]hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] text-sm rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full py-3 px-4 border border-dashed border-[var(--border-default)] hover:border-[var(--brand-blue)]/50 text-[var(--text-secondary)] hover:text-[var(--brand-blue)] rounded-xl transition-colors flex items-center justify-center gap-2"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Open New Gateway
        </button>
      )}
    </div>
  )
}
