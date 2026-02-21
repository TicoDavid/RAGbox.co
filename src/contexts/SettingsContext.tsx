'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

// Theme types
export type ThemeId = 'cobalt' | 'noir' | 'forest' | 'obsidian'

// Language types
export type LanguageId = 'en' | 'es' | 'de' | 'fr' | 'zh'

export interface LanguageConfig {
  id: LanguageId
  name: string
  nativeName: string
}

export const LANGUAGES: Record<LanguageId, LanguageConfig> = {
  en: { id: 'en', name: 'English', nativeName: 'English' },
  es: { id: 'es', name: 'Spanish', nativeName: 'Español' },
  de: { id: 'de', name: 'German', nativeName: 'Deutsch' },
  fr: { id: 'fr', name: 'French', nativeName: 'Français' },
  zh: { id: 'zh', name: 'Mandarin', nativeName: '中文' },
}

// Density types
export type DensityId = 'compact' | 'comfortable'

// Voice configuration
export interface VoiceSettings {
  enabled: boolean
  autoSubmit: boolean
  silenceThreshold: number // ms
}

// Subscription/Plan info
export interface SubscriptionInfo {
  plan: 'free' | 'professional' | 'enterprise'
  tokensUsed: number
  tokensLimit: number
  renewalDate: string
}

export interface ThemeConfig {
  id: ThemeId
  name: string
  colors: string[]
}

export const THEMES: Record<ThemeId, ThemeConfig> = {
  cobalt: {
    id: 'cobalt',
    name: 'Midnight Cobalt',
    colors: ['#0A192F', '#112240', '#2463EB'],
  },
  noir: {
    id: 'noir',
    name: 'Cyber Noir',
    colors: ['#000000', '#0A0A0A', '#00F0FF'],
  },
  forest: {
    id: 'forest',
    name: 'Forest Dark',
    colors: ['#022c22', '#064e3b', '#10b981'],
  },
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian Gold',
    colors: ['#020408', '#0F0F0F', '#F59E0B'],
  },
}

// Universal Connection type - OpenRouter is the recommended gateway
export type ConnectionType = 'openrouter' | 'openai' | 'anthropic' | 'google' | 'local' | 'custom'

// Cached model info from OpenRouter
export interface CachedModel {
  id: string
  name: string
  contextLength: number
}

export interface SecureConnection {
  id: string
  name: string
  type: ConnectionType
  endpoint: string
  apiKey: string // In production, this would be encrypted/hashed
  verified: boolean
  createdAt: string
  // OpenRouter-specific: available models and selected model
  availableModels?: CachedModel[]
  selectedModel?: string
}

// Notifications
export interface NotificationSettings {
  email: boolean
  push: boolean
  audit: boolean
}

// Intelligence tier types
export type IntelligenceTier = 'native' | 'managed' | 'universe' | 'private'

// LLM Policy — controls AEGIS vs Private LLM availability
export type LlmPolicy = 'choice' | 'byollm_only' | 'aegis_only'

export interface ActiveIntelligence {
  id: string           // e.g., 'aegis-core' or 'anthropic/claude-3.5-sonnet'
  displayName: string  // e.g., 'Aegis' or 'Claude 3.5 Sonnet'
  provider: string     // e.g., 'RAGbox' or 'Anthropic'
  tier: IntelligenceTier
}

// Full settings state
interface SettingsState {
  theme: ThemeId
  language: LanguageId
  density: DensityId
  connections: SecureConnection[]
  notifications: NotificationSettings
  voice: VoiceSettings
  subscription: SubscriptionInfo
  activeIntelligence: ActiveIntelligence
  llmPolicy: LlmPolicy
}

// Context value
interface SettingsContextValue extends SettingsState {
  setTheme: (theme: ThemeId) => void
  setLanguage: (language: LanguageId) => void
  setDensity: (density: DensityId) => void
  addConnection: (connection: Omit<SecureConnection, 'id' | 'verified' | 'createdAt'>) => Promise<SecureConnection>
  updateConnection: (id: string, updates: Partial<SecureConnection>) => void
  deleteConnection: (id: string) => void
  verifyConnection: (id: string) => Promise<boolean>
  setNotification: (key: keyof NotificationSettings, value: boolean) => void
  setConnectionModel: (connectionId: string, modelId: string) => void
  updateVoice: (updates: Partial<VoiceSettings>) => void
  setActiveIntelligence: (intel: ActiveIntelligence) => void
  setLlmPolicy: (policy: LlmPolicy) => void
  isVerifying: string | null // ID of connection being verified
  hasVerifiedConnection: boolean // For UI badges like "Enhanced OCR"
  // Active model info for header display (legacy - use activeIntelligence instead)
  activeModel: string | null
  activeModelProvider: string | null
  // Aegis is active when using native tier
  isAegisActive: boolean
}

// The Aegis default - sovereign AI running on RAGbox infrastructure
const AEGIS_DEFAULT: ActiveIntelligence = {
  id: 'aegis-core',
  displayName: 'Aegis',
  provider: 'RAGbox',
  tier: 'native',
}

const defaultSettings: SettingsState = {
  theme: 'cobalt',
  language: 'en',
  density: 'comfortable',
  connections: [],
  notifications: { email: true, push: false, audit: true },
  voice: {
    enabled: true,
    autoSubmit: true,
    silenceThreshold: 2000,
  },
  subscription: {
    plan: 'enterprise',
    tokensUsed: 847500,
    tokensLimit: 5000000,
    renewalDate: '2025-02-15',
  },
  activeIntelligence: AEGIS_DEFAULT,
  llmPolicy: 'choice',
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

const STORAGE_KEY = 'ragbox-settings'

// Generate unique ID
function generateId(): string {
  return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Detect connection type from endpoint
function detectConnectionType(endpoint: string): ConnectionType {
  const lower = endpoint.toLowerCase()
  if (lower.includes('openrouter.ai')) return 'openrouter'
  if (lower.includes('openai.com')) return 'openai'
  if (lower.includes('anthropic.com')) return 'anthropic'
  if (lower.includes('googleapis.com') || lower.includes('google')) return 'google'
  if (lower.includes('localhost') || lower.includes('127.0.0.1')) return 'local'
  return 'custom'
}

// Extract provider name from model ID (e.g., "anthropic/claude-3.5-sonnet" -> "Anthropic")
function getProviderFromModel(modelId: string): string {
  const parts = modelId.split('/')
  if (parts.length < 2) return 'Unknown'
  const providerMap: Record<string, string> = {
    'anthropic': 'Anthropic',
    'openai': 'OpenAI',
    'google': 'Google',
    'meta-llama': 'Meta',
    'mistralai': 'Mistral',
  }
  return providerMap[parts[0]] || parts[0]
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<SettingsState>(defaultSettings)
  const [isVerifying, setIsVerifying] = useState<string | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        // Migration: convert old apiKeys format to new connections format
        if (parsed.apiKeys && !parsed.connections) {
          const migrations: SecureConnection[] = []
          if (parsed.apiKeys.openai) {
            migrations.push({
              id: generateId(),
              name: 'OpenAI API',
              type: 'openai',
              endpoint: 'https://api.openai.com/v1',
              apiKey: parsed.apiKeys.openai,
              verified: true,
              createdAt: new Date().toISOString(),
            })
          }
          if (parsed.apiKeys.google) {
            migrations.push({
              id: generateId(),
              name: 'Google Cloud API',
              type: 'google',
              endpoint: 'https://documentai.googleapis.com',
              apiKey: parsed.apiKeys.google,
              verified: parsed.googleKeyVerified || false,
              createdAt: new Date().toISOString(),
            })
          }
          parsed.connections = migrations
          delete parsed.apiKeys
          delete parsed.googleKeyVerified
        }
        setSettings({ ...defaultSettings, ...parsed })
      }
    } catch {
      // Silently ignore
    }
    setIsHydrated(true)
  }, [])

  // Hydrate LLM policy from server (overrides localStorage default)
  useEffect(() => {
    fetch('/api/settings/llm')
      .then((r) => r.ok ? r.json() : null)
      .then((json) => {
        const policy = json?.data?.policy
        if (policy && ['choice', 'byollm_only', 'aegis_only'].includes(policy)) {
          setSettings((prev) => ({ ...prev, llmPolicy: policy }))
        }
      })
      .catch(() => {})
  }, [])

  // Save to localStorage on change
  useEffect(() => {
    if (isHydrated) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      } catch {
        // Silently ignore
      }
    }
  }, [settings, isHydrated])

  // Apply theme to document
  useEffect(() => {
    if (isHydrated) {
      document.documentElement.setAttribute('data-theme', settings.theme)
    }
  }, [settings.theme, isHydrated])

  const setTheme = useCallback((theme: ThemeId) => {
    setSettings((prev) => ({ ...prev, theme }))
  }, [])

  const setLanguage = useCallback((language: LanguageId) => {
    setSettings((prev) => ({ ...prev, language }))
  }, [])

  const setDensity = useCallback((density: DensityId) => {
    setSettings((prev) => ({ ...prev, density }))
  }, [])

  const addConnection = useCallback(async (
    connection: Omit<SecureConnection, 'id' | 'verified' | 'createdAt'>
  ): Promise<SecureConnection> => {
    const newConnection: SecureConnection = {
      ...connection,
      id: generateId(),
      type: connection.type || detectConnectionType(connection.endpoint),
      verified: false,
      createdAt: new Date().toISOString(),
    }

    setSettings((prev) => ({
      ...prev,
      connections: [...prev.connections, newConnection],
    }))

    return newConnection
  }, [])

  const updateConnection = useCallback((id: string, updates: Partial<SecureConnection>) => {
    setSettings((prev) => ({
      ...prev,
      connections: prev.connections.map((conn) => {
        if (conn.id !== id) return conn

        // If apiKey changed AND verified wasn't explicitly set, reset verified
        const shouldResetVerified = updates.apiKey !== undefined && updates.verified === undefined

        return {
          ...conn,
          ...updates,
          verified: shouldResetVerified ? false : (updates.verified ?? conn.verified),
        }
      }),
    }))
  }, [])

  const deleteConnection = useCallback((id: string) => {
    setSettings((prev) => ({
      ...prev,
      connections: prev.connections.filter((conn) => conn.id !== id),
    }))
  }, [])

  const verifyConnection = useCallback(async (id: string): Promise<boolean> => {
    setIsVerifying(id)

    const connection = settings.connections.find((c) => c.id === id)
    if (!connection) {
      setIsVerifying(null)
      return false
    }

    // Simulate API verification (ping the endpoint)
    await new Promise((r) => setTimeout(r, 1500))

    // Simple validation: key must be > 10 chars and endpoint must be valid URL
    const isValid = connection.apiKey.length > 10 && connection.endpoint.startsWith('http')

    setSettings((prev) => ({
      ...prev,
      connections: prev.connections.map((conn) =>
        conn.id === id ? { ...conn, verified: isValid } : conn
      ),
    }))

    setIsVerifying(null)
    return isValid
  }, [settings.connections])

  const setNotification = useCallback((key: keyof NotificationSettings, value: boolean) => {
    setSettings((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: value },
    }))
  }, [])

  const setConnectionModel = useCallback((connectionId: string, modelId: string) => {
    setSettings((prev) => ({
      ...prev,
      connections: prev.connections.map((conn) =>
        conn.id === connectionId ? { ...conn, selectedModel: modelId } : conn
      ),
    }))
  }, [])

  const updateVoice = useCallback((updates: Partial<VoiceSettings>) => {
    setSettings((prev) => ({
      ...prev,
      voice: { ...prev.voice, ...updates },
    }))
  }, [])

  const setActiveIntelligence = useCallback((intel: ActiveIntelligence) => {
    setSettings((prev) => ({
      ...prev,
      activeIntelligence: intel,
    }))
  }, [])

  const setLlmPolicy = useCallback((policy: LlmPolicy) => {
    setSettings((prev) => ({ ...prev, llmPolicy: policy }))
  }, [])

  // Check if any connection is verified (for UI badges)
  const hasVerifiedConnection = settings.connections.some((c) => c.verified)

  // Get the active model from the first OpenRouter connection with a selected model
  const openRouterConnection = settings.connections.find((c) => c.type === 'openrouter' && c.verified && c.selectedModel)
  const activeModel = openRouterConnection?.selectedModel || null
  const activeModelProvider = activeModel ? getProviderFromModel(activeModel) : null

  // Aegis is active when using native tier
  const isAegisActive = settings.activeIntelligence.tier === 'native'

  const value: SettingsContextValue = {
    ...settings,
    setTheme,
    setLanguage,
    setDensity,
    addConnection,
    updateConnection,
    deleteConnection,
    verifyConnection,
    setNotification,
    setConnectionModel,
    updateVoice,
    setActiveIntelligence,
    setLlmPolicy,
    isVerifying,
    hasVerifiedConnection,
    activeModel,
    activeModelProvider,
    isAegisActive,
  }

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider')
  }
  return context
}
