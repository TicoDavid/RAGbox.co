/**
 * @jest-environment jsdom
 */

/**
 * TASK 2: Integration Page Tests — EPIC-010
 *
 * Render tests for Jordan's STORY-100 (ROAM UI) and STORY-106 (WhatsApp UI).
 *
 * — Sarah, Engineering
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// ── Mock sonner ──────────────────────────────────────────────────
jest.mock('sonner', () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}))

// ── Mock apiFetch ────────────────────────────────────────────────
let apiFetchCalls: Array<{ url: string; options?: Record<string, unknown> }> = []

const MOCK_SETTINGS = {
  whatsappEnabled: true,
  whatsappProvider: 'vonage',
  vonageApiKey: '****',
  vonageApiSecret: '****',
  vonageApplicationId: null,
  vonageWhatsAppNumber: '+1 (415) 738-6102',
  metaAccessToken: null,
  metaPhoneNumberId: null,
  metaAppSecret: null,
  mercuryVoiceEnabled: true,
  mercuryVoiceModel: 'aura-asteria-en',
  mercuryAutoReply: true,
  whatsappAllowInbound: true,
  whatsappAllowOutbound: true,
  whatsappAllowVoiceNotes: true,
  whatsappAllowedNumbers: [],
  defaultVaultId: null,
}

const MOCK_ROAM_STATUS = {
  connected: false,
  workspace: null,
  lastWebhook: null,
  messageCount: 0,
  subscriptionIds: [],
  targetGroupId: null,
  targetGroupName: null,
  error: null,
}

const MOCK_ROAM_GROUPS = [
  { id: 'group-1', name: 'Engineering', memberCount: 8 },
  { id: 'group-2', name: 'Marketing', memberCount: 5 },
]

/** apiFetch wraps fetch() — returns Response-like objects with .ok and .json() */
function mockResponse(body: unknown) {
  return { ok: true, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) }
}

jest.mock('@/lib/api', () => ({
  apiFetch: jest.fn(async (url: string, options?: Record<string, unknown>) => {
    apiFetchCalls.push({ url, options })

    if (url.includes('/api/settings/integrations') && (!options || !options.method || options.method === 'GET')) {
      return mockResponse({ success: true, data: MOCK_SETTINGS })
    }
    if (url.includes('/api/connectors/roam/status')) {
      return mockResponse(MOCK_ROAM_STATUS)
    }
    if (url.includes('/api/connectors/roam/groups')) {
      return mockResponse(MOCK_ROAM_GROUPS)
    }
    if (url.includes('/api/connectors/roam/test')) {
      return mockResponse({ valid: true, workspace: 'ConnexUS Ai Inc', groupCount: 2 })
    }
    if (url.includes('/api/connectors/roam/install')) {
      return mockResponse({ status: 'connected', workspace: 'ConnexUS Ai Inc', groups: MOCK_ROAM_GROUPS })
    }
    if (url.includes('/api/connectors/roam/uninstall')) {
      return mockResponse({ status: 'disconnected' })
    }
    if (url.includes('/api/vaults')) {
      return mockResponse({ success: true, data: [] })
    }
    if (url.includes('/api/settings/integrations') && options?.method === 'PUT') {
      return mockResponse({ success: true })
    }
    return mockResponse({ success: true })
  }),
}))

// ── Mock lucide-react (catch-all Proxy for any icon) ────────────
jest.mock('lucide-react', () => {
  return new Proxy({}, {
    get: (_target, prop) => {
      if (typeof prop !== 'string') return undefined
      return ({ className }: { className?: string }) =>
        React.createElement('svg', { 'data-testid': `icon-${prop}`, className })
    },
  })
})

// ── Import component ─────────────────────────────────────────────
import IntegrationsSettings from '@/app/dashboard/settings/integrations/page'

// ── Setup ────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
  apiFetchCalls = []
})

// ── Tests ────────────────────────────────────────────────────────

describe('IntegrationsPage', () => {
  it('ROAM card renders with API key input and response mode options', async () => {
    render(<IntegrationsSettings />)

    await waitFor(() => {
      expect(screen.getByText('ROAM')).toBeInTheDocument()
    })

    // API key input (J01 updated placeholder)
    expect(screen.getByPlaceholderText(/ROAM API key/i)).toBeInTheDocument()

    // Response mode options (J01: replaced toggles with radio group)
    expect(screen.getByText(/Mentions only/i)).toBeInTheDocument()
  })

  it('WhatsApp Vonage card shows "Connected" state', async () => {
    render(<IntegrationsSettings />)

    await waitFor(() => {
      expect(screen.getAllByText('WhatsApp').length).toBeGreaterThan(0)
    })

    // Vonage badge
    expect(screen.getByText('Vonage')).toBeInTheDocument()

    // Phone number displayed
    expect(screen.getByText('+1 (415) 738-6102')).toBeInTheDocument()
  })

  it('WhatsApp Meta Cloud card shows "Coming Soon" banner', async () => {
    render(<IntegrationsSettings />)

    await waitFor(() => {
      expect(screen.getByText('Coming Soon')).toBeInTheDocument()
    })

    expect(screen.getByText('Meta Cloud API')).toBeInTheDocument()
    expect(screen.getByText(/Meta Business Verification Required/i)).toBeInTheDocument()
  })

  it('ROAM save calls POST /api/connectors/roam/install', async () => {
    render(<IntegrationsSettings />)

    await waitFor(() => {
      expect(screen.getByText('ROAM')).toBeInTheDocument()
    })

    // Type API key
    const keyInput = screen.getByPlaceholderText(/ROAM API key/i)
    fireEvent.change(keyInput, { target: { value: 'roam_test_key_123' } })
    fireEvent.blur(keyInput)

    // Wait for groups or test connection response
    await waitFor(() => {
      expect(apiFetchCalls.some((c) => c.url.includes('/roam/'))).toBe(true)
    })

    // Click Save
    const saveBtn = screen.getByText('Save')
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(apiFetchCalls.some((c) => c.url.includes('/roam/install'))).toBe(true)
    })

    const installCall = apiFetchCalls.find((c) => c.url.includes('/roam/install'))
    expect(installCall!.options?.method).toBe('POST')
  })

  it('ROAM disconnect button calls POST /api/connectors/roam/uninstall', async () => {
    // Override to show connected state
    const { apiFetch } = jest.requireMock('@/lib/api')
    apiFetch.mockImplementation(async (url: string, options?: Record<string, unknown>) => {
      apiFetchCalls.push({ url, options })
      if (url.includes('/roam/status')) {
        return mockResponse({
          data: {
            status: 'connected',
            workspaceName: 'ConnexUS Ai Inc',
            lastWebhook: '2026-02-22T12:00:00Z',
            messageCount: 42,
            subscriptionIds: ['sub-1', 'sub-2'],
            targetGroupId: 'group-1',
            targetGroupName: 'Engineering Team',
            responseMode: 'mentions',
            error: null,
          },
        })
      }
      if (url.includes('/roam/uninstall')) {
        return mockResponse({ status: 'disconnected' })
      }
      if (url.includes('/api/settings/integrations')) {
        return mockResponse({ success: true, data: MOCK_SETTINGS })
      }
      if (url.includes('/api/vaults')) {
        return mockResponse({ success: true, data: [] })
      }
      return mockResponse({ success: true })
    })

    render(<IntegrationsSettings />)

    // Wait for connected state to render (workspace or disconnect button)
    await waitFor(() => {
      expect(screen.getByText('Disconnect')).toBeInTheDocument()
    })

    // Click disconnect
    const disconnectBtn = screen.getByText('Disconnect')
    fireEvent.click(disconnectBtn)

    await waitFor(() => {
      expect(apiFetchCalls.some((c) => c.url.includes('/roam/uninstall'))).toBe(true)
    })

    const uninstallCall = apiFetchCalls.find((c) => c.url.includes('/roam/uninstall'))
    expect(uninstallCall!.options?.method).toBe('POST')
  })
})
