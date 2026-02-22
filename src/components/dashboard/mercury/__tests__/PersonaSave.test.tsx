/**
 * @jest-environment jsdom
 */

/**
 * Tests for Mercury persona save pipeline — EPIC-008.5
 *
 * Verifies that the MercurySettingsModal sends the correct field names
 * and values to POST /api/mercury/config when saving persona config.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// ── Mock next/navigation ────────────────────────────────────────
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}))

// ── Mock sonner ──────────────────────────────────────────────────
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

// ── Mock framer-motion ───────────────────────────────────────────
jest.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLDivElement>) => {
      const safe: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(props)) {
        if (!['initial', 'animate', 'exit', 'transition', 'variants', 'whileHover', 'whileTap'].includes(k)) {
          safe[k] = v
        }
      }
      return <div ref={ref} {...safe}>{children}</div>
    }),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}))

// ── Mock fetch ───────────────────────────────────────────────────
const CONFIG_RESPONSE = {
  success: true,
  data: {
    config: {
      name: 'Mercury',
      title: 'AI Assistant',
      greeting: 'Welcome to RAGbox.',
      personality: '',
      role: '',
      personalityPrompt: '',
      voiceGender: 'female',
      silenceThreshold: 0.60,
      channels: {
        email: { enabled: false },
        whatsapp: { enabled: false },
        voice: { enabled: true },
      },
    },
  },
}

let fetchCalls: Array<{ url: string; options?: RequestInit }> = []

beforeEach(() => {
  jest.clearAllMocks()
  fetchCalls = []
  global.fetch = jest.fn(async (url: string | URL | Request, options?: RequestInit) => {
    const urlStr = typeof url === 'string' ? url : url.toString()
    fetchCalls.push({ url: urlStr, options })
    return {
      ok: true,
      json: () => Promise.resolve(
        options?.method === 'POST'
          ? { success: true, data: { config: {} } }
          : CONFIG_RESPONSE
      ),
    }
  }) as jest.Mock
})

import { MercurySettingsModal } from '../MercurySettingsModal'

// ── Helpers ──────────────────────────────────────────────────────

function getPostBody(): Record<string, unknown> | null {
  const postCall = fetchCalls.find((c) => c.options?.method === 'POST')
  if (!postCall?.options?.body) return null
  return JSON.parse(postCall.options.body as string)
}

async function renderAndWaitForLoad() {
  render(<MercurySettingsModal open={true} onClose={jest.fn()} onSaved={jest.fn()} />)
  // Wait for Identity section content to render (default active tab)
  await waitFor(() => {
    expect(screen.getByText('Agent Name')).toBeInTheDocument()
  })
  // Switch to Persona tab where Personality/Role selectors live
  fireEvent.click(screen.getByText('Persona'))
  await waitFor(() => {
    expect(screen.getByText('Personality')).toBeInTheDocument()
  })
}

async function clickSave() {
  const saveBtn = screen.getByText('Save Changes')
  fireEvent.click(saveBtn)
  await waitFor(() => {
    expect(fetchCalls.some((c) => c.options?.method === 'POST')).toBe(true)
  })
}

// ── Tests ────────────────────────────────────────────────────────

describe('PersonaSave pipeline', () => {
  it('save sends personalityPreset field (not just personality)', async () => {
    await renderAndWaitForLoad()

    // Select a personality to make dirty
    fireEvent.click(screen.getByText('Professional'))
    await clickSave()

    const body = getPostBody()
    expect(body).not.toBeNull()
    expect(body).toHaveProperty('personalityPreset')
  })

  it('selecting Professional → save → API receives personalityPreset="professional"', async () => {
    await renderAndWaitForLoad()

    fireEvent.click(screen.getByText('Professional'))
    await clickSave()

    const body = getPostBody()
    expect(body!.personalityPreset).toBe('professional')
  })

  it('selecting CEO → save → API receives personalityPreset="ceo"', async () => {
    await renderAndWaitForLoad()

    fireEvent.click(screen.getByText('CEO'))
    await clickSave()

    const body = getPostBody()
    // CEO is a role, not a personality — it maps to rolePreset
    expect(body!.rolePreset).toBe('ceo')
  })

  it('custom prompt text → save → API receives personalityPrompt with content', async () => {
    await renderAndWaitForLoad()

    // Find the Custom Instructions textarea
    const textarea = screen.getByPlaceholderText('Additional personality instructions...')
    fireEvent.change(textarea, { target: { value: 'Be extremely concise and cite all sources.' } })
    await clickSave()

    const body = getPostBody()
    expect(body!.personalityPrompt).toBe('Be extremely concise and cite all sources.')
  })

  it('role selection → save → API receives role field', async () => {
    await renderAndWaitForLoad()

    fireEvent.click(screen.getByText('Legal'))
    await clickSave()

    const body = getPostBody()
    expect(body!.role).toBe('legal')
    expect(body!.rolePreset).toBe('legal')
  })
})
