import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

// ── Mock useSettings ────────────────────────────────────────────
const mockSetActiveIntelligence = jest.fn()

let mockSettings = {
  connections: [] as Array<{ id: string; type: string; verified: boolean; selectedModel: string | null }>,
  activeIntelligence: {
    id: 'aegis-core',
    displayName: 'Aegis',
    provider: 'RAGbox',
    tier: 'native' as 'native' | 'managed' | 'universe' | 'private',
  },
  setActiveIntelligence: mockSetActiveIntelligence,
  llmPolicy: 'choice' as 'choice' | 'byollm_only' | 'aegis_only',
}

jest.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => mockSettings,
}))

// ── Mock sonner ─────────────────────────────────────────────────
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}))

import { LlmPicker } from '@/components/dashboard/mercury/ChatModelPicker'

describe('LlmPicker', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSettings = {
      connections: [],
      activeIntelligence: {
        id: 'aegis-core',
        displayName: 'Aegis',
        provider: 'RAGbox',
        tier: 'native',
      },
      setActiveIntelligence: mockSetActiveIntelligence,
      llmPolicy: 'choice',
    }
  })

  it('renders AEGIS card as default active', () => {
    render(<LlmPicker />)
    expect(screen.getByText('AEGIS')).toBeInTheDocument()
    expect(screen.getByText('ConnexUS Sovereign AI')).toBeInTheDocument()
  })

  it('shows "Configure in Settings" when no BYOLLM connection exists', () => {
    render(<LlmPicker />)
    expect(screen.getByText('Private LLM')).toBeInTheDocument()
    expect(screen.getByText(/Configure in Settings/)).toBeInTheDocument()
  })

  it('shows provider and model name for configured BYOLLM', () => {
    mockSettings.connections = [
      { id: 'conn-1', type: 'openai', verified: true, selectedModel: 'openai/gpt-4o' },
    ]
    render(<LlmPicker />)
    expect(screen.getByText('gpt-4o')).toBeInTheDocument()
    expect(screen.getByText('via openai')).toBeInTheDocument()
  })

  it('switches to Private LLM on click', () => {
    mockSettings.connections = [
      { id: 'conn-1', type: 'anthropic', verified: true, selectedModel: 'anthropic/claude-3.5-sonnet' },
    ]
    render(<LlmPicker />)

    fireEvent.click(screen.getByText('claude-3.5-sonnet'))
    expect(mockSetActiveIntelligence).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'anthropic/claude-3.5-sonnet',
        tier: 'private',
      })
    )
  })

  it('switches back to AEGIS on click', () => {
    mockSettings.connections = [
      { id: 'conn-1', type: 'openai', verified: true, selectedModel: 'openai/gpt-4o' },
    ]
    mockSettings.activeIntelligence = {
      id: 'openai/gpt-4o',
      displayName: 'gpt-4o',
      provider: 'openai',
      tier: 'private' as const,
    }
    render(<LlmPicker />)

    fireEvent.click(screen.getByText('AEGIS'))
    expect(mockSetActiveIntelligence).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'aegis-core',
        tier: 'native',
      })
    )
  })

  it('returns null when policy is aegis_only', () => {
    mockSettings.llmPolicy = 'aegis_only'
    const { container } = render(<LlmPicker />)
    expect(container.firstChild).toBeNull()
  })
})
