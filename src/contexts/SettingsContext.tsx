'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'

// Theme types
export type ThemeId = 'cobalt' | 'noir' | 'forest'

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
}

// Universal Connection type
export type ConnectionType = 'openai' | 'anthropic' | 'google' | 'local' | 'custom'

export interface SecureConnection {
  id: string
  name: string
  type: ConnectionType
  endpoint: string
  apiKey: string // In production, this would be encrypted/hashed
  verified: boolean
  createdAt: string
}

// Notifications
export interface NotificationSettings {
  email: boolean
  push: boolean
  audit: boolean
}

// Full settings state
interface SettingsState {
  theme: ThemeId
  connections: SecureConnection[]
  notifications: NotificationSettings
}

// Context value
interface SettingsContextValue extends SettingsState {
  setTheme: (theme: ThemeId) => void
  addConnection: (connection: Omit<SecureConnection, 'id' | 'verified' | 'createdAt'>) => Promise<SecureConnection>
  updateConnection: (id: string, updates: Partial<SecureConnection>) => void
  deleteConnection: (id: string) => void
  verifyConnection: (id: string) => Promise<boolean>
  setNotification: (key: keyof NotificationSettings, value: boolean) => void
  isVerifying: string | null // ID of connection being verified
  hasVerifiedConnection: boolean // For UI badges like "Enhanced OCR"
}

const defaultSettings: SettingsState = {
  theme: 'cobalt',
  connections: [],
  notifications: { email: true, push: false, audit: true },
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
  if (lower.includes('openai.com')) return 'openai'
  if (lower.includes('anthropic.com')) return 'anthropic'
  if (lower.includes('googleapis.com') || lower.includes('google')) return 'google'
  if (lower.includes('localhost') || lower.includes('127.0.0.1')) return 'local'
  return 'custom'
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
    } catch (e) {
      console.error('Failed to load settings:', e)
    }
    setIsHydrated(true)
  }, [])

  // Save to localStorage on change
  useEffect(() => {
    if (isHydrated) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
      } catch (e) {
        console.error('Failed to save settings:', e)
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
      connections: prev.connections.map((conn) =>
        conn.id === id ? { ...conn, ...updates, verified: updates.apiKey ? false : conn.verified } : conn
      ),
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

  // Check if any connection is verified (for UI badges)
  const hasVerifiedConnection = settings.connections.some((c) => c.verified)

  const value: SettingsContextValue = {
    ...settings,
    setTheme,
    addConnection,
    updateConnection,
    deleteConnection,
    verifyConnection,
    setNotification,
    isVerifying,
    hasVerifiedConnection,
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
