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
  status: 'disconnected' as const,
  targetGroupName: null,
  targetGroupId: null,
  mentionOnly: true,
  meetingSummaries: true,
}

const MOCK_ROAM_GROUPS = [
  { id: 'group-1', name: 'Engineering', memberCount: 8 },
  { id: 'group-2', name: 'Marketing', memberCount: 5 },
]

/** apiFetch wraps fetch() — returns Response-like objects with .ok and .json() */
function mockResponse(body: Record<string, unknown>) {
  return { ok: true, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) }
}

jest.mock('@/lib/api', () => ({
  apiFetch: jest.fn(async (url: string, options?: Record<string, unknown>) => {
    apiFetchCalls.push({ url, options })

    if (url.includes('/api/settings/integrations') && (!options || !options.method || options.method === 'GET')) {
      return mockResponse({ success: true, data: MOCK_SETTINGS })
    }
    if (url.includes('/api/integrations/roam/status')) {
      return mockResponse({ success: true, data: MOCK_ROAM_STATUS })
    }
    if (url.includes('/api/integrations/roam/groups')) {
      return mockResponse({ success: true, data: MOCK_ROAM_GROUPS })
    }
    if (url.includes('/api/integrations/roam/connect')) {
      return mockResponse({ success: true, data: { status: 'connected' } })
    }
    if (url.includes('/api/integrations/roam/disconnect')) {
      return mockResponse({ success: true })
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
  it('ROAM card renders with API key input, groups dropdown, and toggles', async () => {
    render(<IntegrationsSettings />)

    await waitFor(() => {
      expect(screen.getByText('ROAM')).toBeInTheDocument()
    })

    // API key input
    expect(screen.getByPlaceholderText(/ROAM API key/i)).toBeInTheDocument()

    // Toggles
    expect(screen.getByText(/Only respond when mentioned/i)).toBeInTheDocument()
    expect(screen.getByText(/Post summaries after meetings/i)).toBeInTheDocument()
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

  it('ROAM activate button calls POST /api/integrations/roam/connect', async () => {
    render(<IntegrationsSettings />)

    await waitFor(() => {
      expect(screen.getByText('ROAM')).toBeInTheDocument()
    })

    // Type API key and blur to trigger group fetch
    const keyInput = screen.getByPlaceholderText(/ROAM API key/i)
    fireEvent.change(keyInput, { target: { value: 'roam_test_key_123' } })
    fireEvent.blur(keyInput)

    // Wait for groups to render in the dropdown
    await waitFor(() => {
      expect(screen.getByText(/Engineering/)).toBeInTheDocument()
    })

    // Click activate
    const activateBtn = screen.getByText('Activate')
    fireEvent.click(activateBtn)

    await waitFor(() => {
      expect(apiFetchCalls.some((c) => c.url.includes('/roam/connect'))).toBe(true)
    })

    const connectCall = apiFetchCalls.find((c) => c.url.includes('/roam/connect'))
    expect(connectCall!.options?.method).toBe('POST')
  })

  it('ROAM disconnect button calls POST /api/integrations/roam/disconnect', async () => {
    // Override to show connected state
    const { apiFetch } = jest.requireMock('@/lib/api')
    apiFetch.mockImplementation(async (url: string, options?: Record<string, unknown>) => {
      apiFetchCalls.push({ url, options })
      if (url.includes('/roam/status')) {
        return mockResponse({
          success: true,
          data: {
            status: 'connected',
            targetGroupName: 'Engineering Team',
            targetGroupId: 'group-1',
            mentionOnly: true,
            meetingSummaries: true,
            connectedAt: '2026-02-22T10:00:00Z',
          },
        })
      }
      if (url.includes('/roam/disconnect')) {
        return mockResponse({ success: true })
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

    await waitFor(() => {
      expect(screen.getByText('Engineering Team')).toBeInTheDocument()
    })

    // Click disconnect
    const disconnectBtn = screen.getByText('Disconnect')
    fireEvent.click(disconnectBtn)

    await waitFor(() => {
      expect(apiFetchCalls.some((c) => c.url.includes('/roam/disconnect'))).toBe(true)
    })

    const disconnectCall = apiFetchCalls.find((c) => c.url.includes('/roam/disconnect'))
    expect(disconnectCall!.options?.method).toBe('POST')
  })
})
