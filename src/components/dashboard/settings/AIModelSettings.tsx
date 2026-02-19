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
  }, [selectedProvider, apiKeyInput, selectedModel, llmPolicy, byollmConnection, addConnection, updateConnection])

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
        <div className="shrink-0 px-4 py-3 border-b border-white/5">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
            <Brain className="w-4 h-4 text-cyan-400" />
            AI Model Settings
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
          <Brain className="w-4 h-4 text-cyan-400" />
          AI Model Settings
        </h3>
        <p className="text-[10px] text-slate-500 mt-0.5">Configure your intelligence provider</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Error banners */}
        {loadError === 'auth' && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-400">
            Sign in required to manage LLM settings
          </div>
        )}
        {(loadError === 'server' || loadError === 'network') && (
          <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-[10px] text-amber-400/70">
            Could not load saved config — test and save still work
          </div>
        )}

        {/* ─── AEGIS Status Card ─── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">AEGIS</p>
              <p className="text-[10px] text-slate-500">Sovereign AI on RAGbox infrastructure</p>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              ACTIVE
            </span>
          </div>
        </motion.div>

        {/* ─── Private LLM Configuration ─── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="p-3 rounded-xl bg-[var(--bg-primary)]/50 border border-white/5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-cyan-400" />
              <p className="text-sm font-medium text-white">Private LLM</p>
            </div>
            {isConfigured && !isEditing && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-2 py-1 text-[10px] rounded-md text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={handleRemove}
                  className="px-2 py-1 text-[10px] rounded-md text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-3 h-3 inline mr-0.5" />
                  Remove
                </button>
              </div>
            )}
          </div>

          {/* Provider Dropdown */}
          <div>
            <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">Provider</label>
            <div className="relative">
              <select
                value={selectedProvider}
                onChange={(e) => {
                  setSelectedProvider(e.target.value as ByollmProvider)
                  setSelectedModel('')
                  setTestStatus('idle')
                }}
                disabled={isConfigured && !isEditing}
                className="w-full appearance-none px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]/50 border border-white/10 text-sm text-white
                         focus:outline-none focus:border-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {PROVIDER_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            </div>
          </div>

          {/* API Key Input */}
          <div>
            <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">API Key</label>
            {isConfigured && !isEditing ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]/50 border border-white/10">
                <span className="text-sm text-slate-400 font-mono flex-1">
                  {serverConfig?.maskedKey || '***'}
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
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
                  className="w-full px-3 py-2 pr-10 rounded-lg bg-[var(--bg-tertiary)]/50 border border-white/10 text-sm text-white
                           placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 font-mono"
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            )}
          </div>

          {/* Model Selector */}
          {modelOptions.length > 0 && (
            <div>
              <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">Model</label>
              <div className="relative">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={isConfigured && !isEditing}
                  className="w-full appearance-none px-3 py-2 rounded-lg bg-[var(--bg-tertiary)]/50 border border-white/10 text-sm text-white
                           focus:outline-none focus:border-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Select a model...</option>
                  {modelOptions.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
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
                         bg-[var(--bg-tertiary)]/50 border border-white/10 text-slate-300 text-xs font-medium
                         hover:bg-white/5 disabled:opacity-50 transition-all"
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
                         bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-medium
                         hover:bg-cyan-500/20 disabled:opacity-50 transition-all"
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

          {/* Connection Status */}
          <AnimatePresence mode="wait">
            {testStatus === 'connected' && (
              <motion.div
                key="connected"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 text-emerald-400 text-xs"
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
                className="flex items-center gap-2 text-red-400 text-xs"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>{testError || 'Connection failed — check API key'}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Server last-test info (when configured, not editing) */}
          {isConfigured && !isEditing && serverConfig?.lastTestedAt && (
            <div className="text-[10px] text-slate-600">
              Last tested: {new Date(serverConfig.lastTestedAt).toLocaleDateString()}{' '}
              {serverConfig.lastTestResult === 'success' && (
                <span className="text-emerald-500">
                  ({serverConfig.lastTestLatency}ms)
                </span>
              )}
            </div>
          )}
        </motion.div>

        {/* ─── Policy Selection ─── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-3 rounded-xl bg-[var(--bg-primary)]/50 border border-white/5 space-y-2"
        >
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Routing Policy</p>
          {POLICY_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-3 p-2.5 rounded-lg cursor-pointer transition-all
                ${llmPolicy === opt.value
                  ? 'bg-cyan-500/10 border border-cyan-500/30'
                  : 'border border-transparent hover:bg-white/5'
                }`}
            >
              <input
                type="radio"
                name="llmPolicy"
                value={opt.value}
                checked={llmPolicy === opt.value}
                onChange={() => handlePolicyChange(opt.value)}
                className="mt-0.5 accent-cyan-500"
              />
              <div>
                <p className="text-sm text-white font-medium">{opt.label}</p>
                <p className="text-[10px] text-slate-500">{opt.desc}</p>
              </div>
            </label>
          ))}
        </motion.div>
      </div>
    </div>
  )
}
