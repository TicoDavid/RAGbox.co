'use client'

import React, { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck,
  Key,
  Eye,
  EyeOff,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  Wifi,
  Brain,
  Save,
  Trash2,
} from 'lucide-react'
import {
  useSettings,
  type ConnectionType,
  type LlmPolicy,
} from '@/contexts/SettingsContext'
import { apiFetch } from '@/lib/api'
import { ConnectionsHelpText } from './ConnectionsHelpText'

// ============================================================================
// CONSTANTS
// ============================================================================

type ByollmProvider = 'openrouter' | 'openai' | 'anthropic' | 'google'

const PROVIDER_OPTIONS: { value: ByollmProvider; label: string; endpoint: string }[] = [
  { value: 'openrouter', label: 'OpenRouter', endpoint: 'https://openrouter.ai/api/v1' },
  { value: 'openai', label: 'OpenAI', endpoint: 'https://api.openai.com/v1' },
  { value: 'anthropic', label: 'Anthropic', endpoint: 'https://api.anthropic.com/v1' },
  { value: 'google', label: 'Google AI', endpoint: 'https://generativelanguage.googleapis.com/v1' },
]

const HARDCODED_MODELS: Record<string, { id: string; name: string }[]> = {
  openai: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    { id: 'o1', name: 'o1' },
    { id: 'o1-mini', name: 'o1-mini' },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6' },
    { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
  ],
  google: [
    { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
    { id: 'gemini-2.0-pro', name: 'Gemini 2.0 Pro' },
    { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
  ],
  openrouter: [
    { id: 'anthropic/claude-sonnet-4-20250514', name: 'Claude Sonnet 4' },
    { id: 'openai/gpt-4o', name: 'GPT-4o' },
    { id: 'google/gemini-2.0-flash-001', name: 'Gemini 2.0 Flash' },
    { id: 'meta-llama/llama-3.1-405b-instruct', name: 'Llama 3.1 405B' },
  ],
}

const POLICY_OPTIONS: { value: LlmPolicy; label: string; desc: string }[] = [
  { value: 'choice', label: 'User Choice', desc: 'Users toggle between AEGIS and Private LLM' },
  { value: 'byollm_only', label: 'Private LLM Only', desc: 'All queries route to private model' },
  { value: 'aegis_only', label: 'AEGIS Only', desc: 'All queries route to AEGIS (default)' },
]

// ============================================================================
// SERVER CONFIG TYPE (from GET /api/settings/llm)
// ============================================================================

interface ServerConfig {
  configured: boolean
  provider?: string
  maskedKey?: string
  baseUrl?: string | null
  defaultModel?: string | null
  policy?: string
  lastTestedAt?: string | null
  lastTestResult?: string | null
  lastTestLatency?: number | null
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AIModelSettings() {
  const {
    connections,
    addConnection,
    updateConnection,
    deleteConnection,
    setConnectionModel,
    llmPolicy,
    setLlmPolicy,
    setActiveIntelligence,
  } = useSettings()

  // Server-side config loaded from API
  const [serverConfig, setServerConfig] = useState<ServerConfig | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Form state
  const [selectedProvider, setSelectedProvider] = useState<ByollmProvider>('openrouter')
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [selectedModel, setSelectedModel] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'connected' | 'failed'>('idle')
  const [testLatency, setTestLatency] = useState<number | null>(null)
  const [testError, setTestError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  // Find the existing BYOLLM connection in SettingsContext (local state)
  const byollmConnection = connections.find(
    (c) => c.type !== 'local' && c.type !== 'custom'
  )

  // ── Load server config on mount ──
  useEffect(() => {
    async function loadConfig() {
      try {
        const res = await apiFetch('/api/settings/llm')
        if (res.ok) {
          const json = await res.json()
          const data: ServerConfig = json.data
          setServerConfig(data)
          // Sync server state into local form
          if (data.configured) {
            if (data.provider) setSelectedProvider(data.provider as ByollmProvider)
            if (data.defaultModel) setSelectedModel(data.defaultModel)
            if (data.policy) setLlmPolicy(data.policy as LlmPolicy)
          }
        } else if (res.status === 401) {
          setLoadError('auth')
        } else {
          // DB unreachable or other server error — show form with default state
          setServerConfig({ configured: false, policy: 'choice' })
          setLoadError('server')
        }
      } catch {
        // Network error — still show form
        setServerConfig({ configured: false, policy: 'choice' })
        setLoadError('network')
      } finally {
        setIsLoading(false)
      }
    }
    loadConfig()
  }, [setLlmPolicy])

  // ── Test Connection: POST /api/settings/llm/test ──
  const handleTestConnection = useCallback(async () => {
    if (!apiKeyInput.trim()) return

    setTestStatus('testing')
    setTestError(null)

    try {
      const res = await apiFetch('/api/settings/llm/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          apiKey: apiKeyInput,
          model: selectedModel || undefined,
        }),
      })

      const data = await res.json()

      if (data.success) {
        setTestStatus('connected')
        setTestLatency(data.latencyMs ?? null)
      } else {
        setTestStatus('failed')
        setTestLatency(data.latencyMs ?? null)
        setTestError(data.error || 'Connection failed')
      }
    } catch {
      setTestStatus('failed')
      setTestError('Network error — could not reach test endpoint')
    }
  }, [apiKeyInput, selectedProvider, selectedModel])

  // ── Save Config: PUT /api/settings/llm ──
  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      const body: Record<string, unknown> = {
        provider: selectedProvider,
        policy: llmPolicy,
      }
      // Only send apiKey if user entered one (new or editing)
      if (apiKeyInput.trim()) {
        body.apiKey = apiKeyInput
      }
      if (selectedModel) {
        body.defaultModel = selectedModel
      }
      const providerConfig = PROVIDER_OPTIONS.find((p) => p.value === selectedProvider)
      if (providerConfig) {
        body.baseUrl = providerConfig.endpoint
      }

      const res = await apiFetch('/api/settings/llm', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const json = await res.json()

      if (json.success) {
        setServerConfig(json.data)
        // Also sync to SettingsContext for local reactivity
        if (!byollmConnection) {
          const newConn = await addConnection({
            name: `${PROVIDER_OPTIONS.find((p) => p.value === selectedProvider)?.label || selectedProvider} API`,
            type: selectedProvider as ConnectionType,
            endpoint: PROVIDER_OPTIONS.find((p) => p.value === selectedProvider)?.endpoint || '',
            apiKey: apiKeyInput || '***configured-on-server***',
          })
          updateConnection(newConn.id, { verified: true, selectedModel })
        } else {
          updateConnection(byollmConnection.id, {
            type: selectedProvider as ConnectionType,
            verified: true,
            selectedModel,
          })
        }
        // Auto-switch active intelligence so chat uses the saved BYOLLM model
        if (llmPolicy !== 'aegis_only' && selectedModel) {
          const providerLabel = PROVIDER_OPTIONS.find((p) => p.value === selectedProvider)?.label || selectedProvider
          const models = HARDCODED_MODELS[selectedProvider] || []
          const modelLabel = models.find((m) => m.id === selectedModel)?.name || selectedModel
          setActiveIntelligence({
            id: selectedModel,
            displayName: modelLabel,
            provider: providerLabel,
            tier: 'private',
          })
        }
        setIsEditing(false)
        setApiKeyInput('')
      } else {
        setTestError(json.error || 'Failed to save')
      }
    } catch {
      setTestError('Network error — could not save settings')
    } finally {
      setIsSaving(false)
    }
  }, [selectedProvider, apiKeyInput, selectedModel, llmPolicy, byollmConnection, addConnection, updateConnection, setActiveIntelligence])

  // ── Remove Config: DELETE /api/settings/llm ──
  const handleRemove = useCallback(async () => {
    try {
      const res = await apiFetch('/api/settings/llm', { method: 'DELETE' })
      const json = await res.json()
      if (json.success) {
        setServerConfig({ configured: false, policy: 'choice' })
        if (byollmConnection) {
          deleteConnection(byollmConnection.id)
        }
        setTestStatus('idle')
        setTestLatency(null)
        setTestError(null)
        setSelectedModel('')
        setApiKeyInput('')
        setIsEditing(false)
      }
    } catch {
      setTestError('Failed to remove configuration')
    }
  }, [byollmConnection, deleteConnection])

  // ── Policy Change: PUT /api/settings/llm (partial) ──
  const handlePolicyChange = useCallback(async (policy: LlmPolicy) => {
    setLlmPolicy(policy) // Optimistic local update

    // Only persist to server if config exists
    if (serverConfig?.configured) {
      try {
        await apiFetch('/api/settings/llm', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ policy }),
        })
      } catch {
        // Non-fatal — local state already updated
      }
    }
  }, [setLlmPolicy, serverConfig])

  // Build model list for dropdown
  const modelOptions = HARDCODED_MODELS[selectedProvider] || []

  const isConfigured = serverConfig?.configured ?? false

  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="shrink-0 px-4 py-3 border-b border-[var(--border-subtle)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
            <Brain className="w-4 h-4 text-[var(--brand-blue)]" />
            AI Model Settings
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-[var(--brand-blue)] animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-[var(--border-subtle)]">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wider flex items-center gap-2">
          <Brain className="w-4 h-4 text-[var(--brand-blue)]" />
          AI Model Settings
        </h3>
        <p className="text-[10px] text-[var(--text-tertiary)] mt-0.5">Configure your intelligence provider</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Error banners */}
        {loadError === 'auth' && (
          <div className="p-3 rounded-xl bg-[var(--warning)]/10 border border-[var(--warning)]/30 text-xs text-[var(--warning)]">
            Sign in required to manage LLM settings
          </div>
        )}
        {(loadError === 'server' || loadError === 'network') && (
          <div className="p-2.5 rounded-xl bg-[var(--warning)]/5 border border-[var(--warning)]/20 text-[10px] text-[var(--warning)]/70">
            Could not load saved config — test and save still work
          </div>
        )}

        {/* ─── AEGIS Status Card with Toggle ─── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-3 rounded-xl border ${
            llmPolicy !== 'byollm_only'
              ? 'bg-[var(--warning)]/5 border-[var(--warning)]/20'
              : 'bg-[var(--bg-tertiary)]/30 border-[var(--border-subtle)]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              llmPolicy !== 'byollm_only' ? 'bg-[var(--warning)]/10' : 'bg-[var(--bg-elevated)]/30'
            }`}>
              <ShieldCheck className={`w-5 h-5 ${llmPolicy !== 'byollm_only' ? 'text-[var(--warning)]' : 'text-[var(--text-tertiary)]'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--text-primary)]">AEGIS</p>
              <p className="text-[10px] text-[var(--text-tertiary)]">Sovereign AI on RAGbox infrastructure</p>
            </div>
            <button
              onClick={() => handlePolicyChange(llmPolicy === 'byollm_only' ? 'aegis_only' : 'byollm_only')}
              aria-label={llmPolicy !== 'byollm_only' ? 'Disable AEGIS' : 'Enable AEGIS'}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                llmPolicy !== 'byollm_only'
                  ? 'bg-[var(--success)]'
                  : 'bg-[var(--bg-elevated)]'
              }`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                llmPolicy !== 'byollm_only' ? 'left-5.5 translate-x-0' : 'left-0.5'
              }`} />
            </button>
          </div>
        </motion.div>

        {/* ─── Private LLM Configuration ─── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="p-3 rounded-xl bg-[var(--bg-primary)]/50 border border-[var(--border-subtle)] space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-[var(--brand-blue)]" />
              <p className="text-sm font-medium text-[var(--text-primary)]">Private LLM</p>
            </div>
            {isConfigured && !isEditing && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-2 py-1 text-[10px] rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]/50 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={handleRemove}
                  className="px-2 py-1 text-[10px] rounded-md text-[var(--danger)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors"
                >
                  <Trash2 className="w-3 h-3 inline mr-0.5" />
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Provider Dropdown */}
          <div>
            <label className="block text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Provider</label>
            <div className="relative">
              <select
                value={selectedProvider}
                onChange={(e) => {
                  setSelectedProvider(e.target.value as ByollmProvider)
                  setSelectedModel('')
                  setTestStatus('idle')
                }}
                disabled={isConfigured && !isEditing}
                className="w-full appearance-none px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]/50 border border-[var(--border-default)] text-sm text-[var(--text-primary)]
                         focus:outline-none focus:border-[var(--brand-blue)]/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {PROVIDER_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)] pointer-events-none" />
            </div>
          </div>

          {/* API Key Input */}
          <div>
            <label className="block text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1">API Key</label>
            {isConfigured && !isEditing ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]/50 border border-[var(--border-default)]">
                <span className="text-sm text-[var(--text-secondary)] font-mono flex-1">
                  {serverConfig?.maskedKey || '***'}
                </span>
                <CheckCircle2 className="w-4 h-4 text-[var(--success)] shrink-0" />
              </div>
            ) : (
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKeyInput}
                  onChange={(e) => {
                    setApiKeyInput(e.target.value)
                    setTestStatus('idle')
                    setTestError(null)
                  }}
                  placeholder="sk-or-... / sk-... / key-..."
                  className="w-full px-3 py-2 pr-10 rounded-lg bg-[var(--bg-tertiary)]/50 border border-[var(--border-default)] text-sm text-[var(--text-primary)]
                           placeholder-[var(--text-placeholder)] focus:outline-none focus:border-[var(--brand-blue)]/50 font-mono"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            )}
            <p className="text-[var(--text-tertiary)] text-xs mt-1">Your key is encrypted with AES-256-GCM. We never see or store it in plaintext.</p>
          </div>

          {/* Model Selector */}
          {modelOptions.length > 0 && (
            <div>
              <label className="block text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1">Model</label>
              <div className="relative">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={isConfigured && !isEditing}
                  className="w-full appearance-none px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]/50 border border-[var(--border-default)] text-sm text-[var(--text-primary)]
                           focus:outline-none focus:border-[var(--brand-blue)]/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Select a model...</option>
                  {modelOptions.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)] pointer-events-none" />
              </div>
            </div>
          )}

          {/* Action Buttons — only when adding/editing */}
          {(!isConfigured || isEditing) && apiKeyInput.length > 5 && (
            <div className="flex gap-2">
              {/* Test Connection */}
              <button
                onClick={handleTestConnection}
                disabled={testStatus === 'testing'}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                         bg-[var(--bg-tertiary)]/50 border border-[var(--border-default)] text-[var(--text-secondary)] text-xs font-medium
                         hover:bg-[var(--bg-elevated)]/50 disabled:opacity-50 transition-all"
              >
                {testStatus === 'testing' ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Wifi className="w-3.5 h-3.5" />
                    Test
                  </>
                )}
              </button>

              {/* Save */}
              <button
                onClick={handleSave}
                disabled={isSaving || testStatus !== 'connected'}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg
                         bg-[var(--brand-blue)]/10 border border-[var(--brand-blue)]/30 text-[var(--brand-blue)] text-xs font-medium
                         hover:bg-[var(--brand-blue)]/20 disabled:opacity-50 transition-all"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Save
                  </>
                )}
              </button>
            </div>
          )}

          {/* Test button help text — shown when action buttons are visible */}
          {(!isConfigured || isEditing) && apiKeyInput.length > 5 && (
            <p className="text-[var(--text-tertiary)] text-xs">Tests connectivity and fetches available models from your provider.</p>
          )}

          {/* Connection Status */}
          <AnimatePresence mode="wait">
            {testStatus === 'connected' && (
              <motion.div
                key="connected"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 text-[var(--success)] text-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Connected{testLatency ? ` (${testLatency}ms)` : ''}</span>
              </motion.div>
            )}
            {testStatus === 'failed' && (
              <motion.div
                key="failed"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 text-[var(--danger)] text-xs"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>{testError || 'Connection failed — check API key'}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Server last-test info (when configured, not editing) */}
          {isConfigured && !isEditing && serverConfig?.lastTestedAt && (
            <div className="text-[10px] text-[var(--text-tertiary)]">
              Last tested: {new Date(serverConfig.lastTestedAt).toLocaleDateString()}{' '}
              {serverConfig.lastTestResult === 'success' && (
                <span className="text-[var(--success)]">
                  ({serverConfig.lastTestLatency}ms)
                </span>
              )}
            </div>
          )}
        </motion.div>

        {/* ─── Connections Help Text ─── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.075 }}
          className="p-3 rounded-xl bg-[var(--bg-primary)]/50 border border-[var(--border-subtle)]"
        >
          <ConnectionsHelpText
            isConfigured={isConfigured}
            provider={PROVIDER_OPTIONS.find((p) => p.value === selectedProvider)?.label}
          />
        </motion.div>

        {/* ─── Policy Selection ─── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-3 rounded-xl bg-[var(--bg-primary)]/50 border border-[var(--border-subtle)] space-y-2"
        >
          <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold">Routing Policy</p>
          {POLICY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-all
                ${llmPolicy === opt.value
                  ? 'bg-[var(--brand-blue)]/10 border border-[var(--brand-blue)]/30'
                  : 'border border-transparent hover:bg-[var(--bg-elevated)]/50'
                }`}
            >
              <input
                type="radio"
                name="llmPolicy"
                value={opt.value}
                checked={llmPolicy === opt.value}
                onChange={() => handlePolicyChange(opt.value)}
                className="mt-0.5 accent-[var(--brand-blue)]"
              />
              <div>
                <p className="text-sm text-[var(--text-primary)] font-medium">{opt.label}</p>
                <p className="text-[10px] text-[var(--text-tertiary)]">{opt.desc}</p>
              </div>
            </label>
          ))}
          <p className="text-[var(--text-tertiary)] text-xs pt-1">AEGIS Only = built-in AI. Private LLM Only = your provider. User&apos;s Choice = switch per message.</p>
        </motion.div>
      </div>
    </div>
  )
}
