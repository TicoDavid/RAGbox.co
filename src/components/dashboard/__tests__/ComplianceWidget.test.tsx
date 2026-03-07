/**
 * Sarah — S-P0-02: ComplianceWidget tests
 *
 * Covers: render, title, Run Now button, loading state, error state,
 * success result display.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'

jest.mock('lucide-react', () => ({
  FileText: (props: React.ComponentProps<'svg'>) => <svg data-testid="icon-filetext" {...props} />,
  RefreshCw: (props: React.ComponentProps<'svg'>) => <svg data-testid="icon-refresh" {...props} />,
  CheckCircle: (props: React.ComponentProps<'svg'>) => <svg data-testid="icon-check" {...props} />,
  AlertCircle: (props: React.ComponentProps<'svg'>) => <svg data-testid="icon-alert" {...props} />,
  Loader2: (props: React.ComponentProps<'svg'>) => <svg data-testid="icon-loader" {...props} />,
}))

import { ComplianceWidget } from '../ComplianceWidget'

describe('ComplianceWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = jest.fn()
  })

  it('renders ROAM Compliance title', () => {
    render(<ComplianceWidget />)
    expect(screen.getByText('ROAM Compliance')).toBeTruthy()
  })

  it('renders Run Now button', () => {
    render(<ComplianceWidget />)
    expect(screen.getByText('Run Now')).toBeTruthy()
  })

  it('shows idle description before any action', () => {
    render(<ComplianceWidget />)
    expect(screen.getByText(/Fetches ROAM conversations daily/)).toBeTruthy()
  })

  it('shows Exporting... text while loading', async () => {
    let resolvePromise: (v: unknown) => void
    const pending = new Promise((r) => { resolvePromise = r })
    ;(global.fetch as jest.Mock).mockReturnValue(pending)

    render(<ComplianceWidget />)
    await act(async () => {
      fireEvent.click(screen.getByText('Run Now'))
    })
    expect(screen.getByText('Exporting...')).toBeTruthy()

    // Cleanup
    resolvePromise!({ ok: true, json: () => Promise.resolve({ success: false }) })
  })

  it('displays result data after successful export', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          success: true,
          data: {
            date: '2026-03-06',
            conversationsIngested: 5,
            messagesProcessed: 42,
            documentsCreated: ['doc1.pdf'],
            errors: [],
          },
        }),
    })

    render(<ComplianceWidget />)
    await act(async () => {
      fireEvent.click(screen.getByText('Run Now'))
    })

    await waitFor(() => {
      expect(screen.getByText(/Last export: 2026-03-06/)).toBeTruthy()
      expect(screen.getByText(/Conversations: 5/)).toBeTruthy()
      expect(screen.getByText(/Messages: 42/)).toBeTruthy()
      expect(screen.getByText('1 documents indexed')).toBeTruthy()
    })
  })

  it('displays error message on failure', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: false, error: 'DB timeout' }),
    })

    render(<ComplianceWidget />)
    await act(async () => {
      fireEvent.click(screen.getByText('Run Now'))
    })

    await waitFor(() => {
      expect(screen.getByText('DB timeout')).toBeTruthy()
    })
  })

  it('displays network error on fetch rejection', async () => {
    ;(global.fetch as jest.Mock).mockRejectedValue(new Error('network'))

    render(<ComplianceWidget />)
    await act(async () => {
      fireEvent.click(screen.getByText('Run Now'))
    })

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeTruthy()
    })
  })
})
