import React from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'

// ── Mock useSettings ────────────────────────────────────────────
const mockSetActiveIntelligence = jest.fn()

let mockSettings = {
  connections: [] as Array<{ id: string; type: string; verified: boolean; selectedModel: string | null; availableModels?: Array<{ id: string; name: string; contextLength: number }> }>,
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

function withByollmConnection(overrides?: Partial<typeof mockSettings>) {
  mockSettings = {
    ...mockSettings,
    connections: [
      { id: 'conn-1', type: 'openrouter', verified: true, selectedModel: 'anthropic/claude-sonnet-4-20250514' },
    ],
    ...overrides,
  }
}

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

  // ── Original tests ────────────────────────────────────────────

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
      tier: 'private' as 'native' | 'managed' | 'universe' | 'private',
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

  // ── SA-04: Extended tests (10 new) ────────────────────────────

  it('opens selector modal when Private LLM card is clicked', () => {
    withByollmConnection()
    render(<LlmPicker />)

    // Click the private card (shows model name when AEGIS is active)
    fireEvent.click(screen.getByText('claude-sonnet-4-20250514'))

    // Modal should appear with "Select Model" header
    expect(screen.getByText('Select Model')).toBeInTheDocument()
    expect(screen.getByText('via OpenRouter')).toBeInTheDocument()
  })

  it('filters models by search query in selector modal', () => {
    withByollmConnection()
    render(<LlmPicker />)

    fireEvent.click(screen.getByText('claude-sonnet-4-20250514'))
    const searchInput = screen.getByPlaceholderText('Search models...')
    fireEvent.change(searchInput, { target: { value: 'gpt' } })

    // Should show GPT models
    expect(screen.getByText('GPT-4o')).toBeInTheDocument()
    expect(screen.getByText('GPT-4o Mini')).toBeInTheDocument()
    // Should not show Claude models
    expect(screen.queryByText('Claude Sonnet 4')).not.toBeInTheDocument()
  })

  it('shows models from provider catalog in selector', () => {
    withByollmConnection()
    render(<LlmPicker />)

    fireEvent.click(screen.getByText('claude-sonnet-4-20250514'))

    // OpenRouter catalog should include various providers
    expect(screen.getByText('Claude Sonnet 4')).toBeInTheDocument()
    expect(screen.getByText('GPT-4o')).toBeInTheDocument()
    expect(screen.getByText('Gemini 2.0 Flash')).toBeInTheDocument()
    expect(screen.getByText('Llama 3.1 405B')).toBeInTheDocument()
    expect(screen.getByText('Mistral Large')).toBeInTheDocument()
  })

  it('highlights selected model with gold accent in selector', () => {
    withByollmConnection({
      activeIntelligence: {
        id: 'anthropic/claude-sonnet-4-20250514',
        displayName: 'Claude Sonnet 4',
        provider: 'openrouter',
        tier: 'private',
      },
    })
    render(<LlmPicker />)

    fireEvent.click(screen.getByText('Claude Sonnet 4'))

    // The selected model should show "Active" badge
    expect(screen.getByText('Active')).toBeInTheDocument()
  })

  it('calls onSelect and closes modal when model is clicked', () => {
    withByollmConnection()
    render(<LlmPicker />)

    fireEvent.click(screen.getByText('claude-sonnet-4-20250514'))
    expect(screen.getByText('Select Model')).toBeInTheDocument()

    // Click a different model
    fireEvent.click(screen.getByText('GPT-4o Mini'))

    // Should have called setActiveIntelligence with the new model
    expect(mockSetActiveIntelligence).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'openai/gpt-4o-mini',
        displayName: 'GPT-4o Mini',
        tier: 'private',
      })
    )

    // Modal should be closed
    expect(screen.queryByText('Select Model')).not.toBeInTheDocument()
  })

  it('closes selector modal on Escape key without saving', () => {
    withByollmConnection()
    render(<LlmPicker />)

    fireEvent.click(screen.getByText('claude-sonnet-4-20250514'))
    expect(screen.getByText('Select Model')).toBeInTheDocument()

    // Press Escape
    fireEvent.keyDown(window, { key: 'Escape' })

    // Modal should close
    expect(screen.queryByText('Select Model')).not.toBeInTheDocument()
    // setActiveIntelligence should NOT have been called from the modal
    // (it was called once from the card click opening the modal)
    const aegisToPrivateCalls = mockSetActiveIntelligence.mock.calls.filter(
      (call: unknown[]) => (call[0] as { tier: string }).tier === 'private'
    )
    // The card click fires setActiveIntelligence, but Escape should not fire another
    expect(aegisToPrivateCalls.length).toBeLessThanOrEqual(1)
  })

  it('shows all models when search is empty', () => {
    withByollmConnection()
    render(<LlmPicker />)

    fireEvent.click(screen.getByText('claude-sonnet-4-20250514'))

    const searchInput = screen.getByPlaceholderText('Search models...')
    // Type something then clear
    fireEvent.change(searchInput, { target: { value: 'xyz' } })
    expect(screen.getByText('No models found')).toBeInTheDocument()

    fireEvent.change(searchInput, { target: { value: '' } })
    // All catalog models should be back
    expect(screen.getByText('Claude Sonnet 4')).toBeInTheDocument()
    expect(screen.getByText('GPT-4o')).toBeInTheDocument()
  })

  it('hides AEGIS card when policy is byollm_only', () => {
    withByollmConnection({ llmPolicy: 'byollm_only' })
    render(<LlmPicker />)

    expect(screen.queryByText('AEGIS')).not.toBeInTheDocument()
    expect(screen.queryByText('ConnexUS Sovereign AI')).not.toBeInTheDocument()
  })

  it('returns null when policy is byollm_only and no connection configured', () => {
    mockSettings.llmPolicy = 'byollm_only'
    mockSettings.connections = []
    const { container } = render(<LlmPicker />)
    expect(container.firstChild).toBeNull()
  })

  it('does not switch to AEGIS when policy is byollm_only', () => {
    withByollmConnection({
      llmPolicy: 'byollm_only',
      activeIntelligence: {
        id: 'anthropic/claude-sonnet-4-20250514',
        displayName: 'Claude Sonnet 4',
        provider: 'openrouter',
        tier: 'private',
      },
    })
    render(<LlmPicker />)

    // AEGIS card should not exist
    expect(screen.queryByText('AEGIS')).not.toBeInTheDocument()
  })
})
