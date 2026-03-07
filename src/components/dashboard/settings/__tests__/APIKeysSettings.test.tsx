/**
 * Sarah — S-P0-02: APIKeysSettings tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('@/services/OpenRouterService', () => ({
  OPENROUTER_ENDPOINT: 'https://openrouter.ai/api/v1',
}))

const mockSettings = {
  connections: [] as { id: string; name: string; endpoint: string; apiKey: string; type: string; verified: boolean; availableModels?: unknown[]; selectedModel?: string }[],
  addConnection: jest.fn(() => Promise.resolve({ id: 'c1' })),
  updateConnection: jest.fn(),
  deleteConnection: jest.fn(),
  verifyConnection: jest.fn(),
  setConnectionModel: jest.fn(),
  isVerifying: null,
}

jest.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => mockSettings,
}))

import { APIKeysSettings } from '../APIKeysSettings'

describe('APIKeysSettings', () => {
  beforeEach(() => {
    mockSettings.connections = []
    jest.clearAllMocks()
  })

  it('renders Secure Uplinks heading', () => {
    render(<APIKeysSettings />)
    expect(screen.getByText('Secure Uplinks')).toBeTruthy()
  })

  it('renders empty state when no connections', () => {
    render(<APIKeysSettings />)
    expect(screen.getByText('No Sovereign Gateway Configured')).toBeTruthy()
  })

  it('renders Open New Gateway button', () => {
    render(<APIKeysSettings />)
    expect(screen.getByText('Open New Gateway')).toBeTruthy()
  })

  it('shows add form on button click', () => {
    render(<APIKeysSettings />)
    fireEvent.click(screen.getByText('Open New Gateway'))
    expect(screen.getByText('New Gateway Connection')).toBeTruthy()
  })

  it('shows provider options in add form', () => {
    render(<APIKeysSettings />)
    fireEvent.click(screen.getByText('Open New Gateway'))
    expect(screen.getByText('OpenRouter')).toBeTruthy()
    expect(screen.getByText('OpenAI Direct')).toBeTruthy()
  })
})
