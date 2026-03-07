/**
 * Sarah — S-P0-02: IntegrationStatusDots tests
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { IntegrationStatusDots } from '../IntegrationStatusDots'

describe('IntegrationStatusDots', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns null before loading', () => {
    global.fetch = jest.fn(() => new Promise(() => {})) as jest.Mock
    const { container } = render(<IntegrationStatusDots />)
    expect(container.innerHTML).toBe('')
  })

  it('shows ROAM connected status', async () => {
    global.fetch = jest.fn((url: string) => {
      if (url.includes('roam')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: { status: 'connected' } }) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: { whatsappEnabled: false } }) })
    }) as jest.Mock
    render(<IntegrationStatusDots />)
    await waitFor(() => {
      expect(screen.getByText('ROAM')).toBeTruthy()
    })
  })

  it('shows WhatsApp connected status', async () => {
    global.fetch = jest.fn((url: string) => {
      if (url.includes('roam')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: { status: 'hidden' } }) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: { whatsappEnabled: true } }) })
    }) as jest.Mock
    render(<IntegrationStatusDots />)
    await waitFor(() => {
      expect(screen.getByText('WhatsApp')).toBeTruthy()
    })
  })

  it('returns null when no integrations are active', async () => {
    global.fetch = jest.fn((url: string) => {
      if (url.includes('roam')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: {} }) })
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ data: {} }) })
    }) as jest.Mock
    const { container } = render(<IntegrationStatusDots />)
    await waitFor(() => {
      expect(container.innerHTML).toBe('')
    })
  })
})
