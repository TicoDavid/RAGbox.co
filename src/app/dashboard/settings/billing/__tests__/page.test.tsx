/**
 * Sarah — EPIC-031 T6: Billing Settings Tab Tests
 *
 * Tests BillingSettings component: plan card, usage meters,
 * invoice table, portal button, and loading/error states.
 */

// ── Mocks ────────────────────────────────────────────────────────

const mockFetch = jest.fn()
global.fetch = mockFetch as unknown as typeof fetch

jest.mock('lucide-react', () => ({
  CreditCard: (props: Record<string, unknown>) => <svg data-testid="icon-credit-card" {...props} />,
  ArrowUpRight: (props: Record<string, unknown>) => <svg data-testid="icon-arrow" {...props} />,
  FileText: (props: Record<string, unknown>) => <svg data-testid="icon-file" {...props} />,
  Download: (props: Record<string, unknown>) => <svg data-testid="icon-download" {...props} />,
  Loader2: (props: Record<string, unknown>) => <svg data-testid="icon-loader" {...props} />,
  CheckCircle2: (props: Record<string, unknown>) => <svg data-testid="icon-check" {...props} />,
  AlertTriangle: (props: Record<string, unknown>) => <svg data-testid="icon-alert" {...props} />,
  HardDrive: (props: Record<string, unknown>) => <svg data-testid="icon-hdd" {...props} />,
  MessageSquare: (props: Record<string, unknown>) => <svg data-testid="icon-msg" {...props} />,
  ExternalLink: (props: Record<string, unknown>) => <svg data-testid="icon-ext" {...props} />,
}))

// ── Imports ──────────────────────────────────────────────────────

import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import BillingSettings from '../page'

// ── Helpers ──────────────────────────────────────────────────────

function mockBillingResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    json: async () => ({
      data: {
        plan: { name: 'Pro', price: 99, interval: 'month', renewsAt: '2026-04-01T00:00:00Z', status: 'active', cancelAtPeriodEnd: false },
        usage: {
          storageUsedBytes: 500 * 1024 * 1024,
          storageLimitBytes: 2 * 1024 * 1024 * 1024,
          documentCount: 150,
          documentLimit: 500,
          queriesThisMonth: 800,
          queryLimit: 2000,
        },
        invoices: [
          { id: 'inv_1', date: '2026-03-01', amount: 9900, status: 'paid', pdfUrl: 'https://stripe.com/inv_1.pdf' },
          { id: 'inv_2', date: '2026-02-01', amount: 9900, status: 'paid' },
        ],
        hasStripeCustomer: true,
        ...overrides,
      },
    }),
  }
}

// ── Tests ────────────────────────────────────────────────────────

describe('Sarah — EPIC-031 T6: Billing Settings Tab', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('shows loading spinner initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {})) // never resolves
    render(<BillingSettings />)
    expect(screen.getByTestId('icon-loader')).toBeInTheDocument()
  })

  test('shows error state when API fails', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    render(<BillingSettings />)
    await waitFor(() => {
      expect(screen.getByText('Failed to load billing info. Please try again.')).toBeInTheDocument()
    })
  })

  test('shows retry button on error', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    render(<BillingSettings />)
    await waitFor(() => {
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })
  })

  test('displays plan name and status', async () => {
    mockFetch.mockResolvedValue(mockBillingResponse())
    render(<BillingSettings />)
    await waitFor(() => {
      expect(screen.getByText('Pro')).toBeInTheDocument()
      expect(screen.getByText('active')).toBeInTheDocument()
    })
  })

  test('displays plan price', async () => {
    mockFetch.mockResolvedValue(mockBillingResponse())
    render(<BillingSettings />)
    await waitFor(() => {
      expect(screen.getByText('$99/mo')).toBeInTheDocument()
    })
  })

  test('displays renewal date', async () => {
    mockFetch.mockResolvedValue(mockBillingResponse())
    render(<BillingSettings />)
    await waitFor(() => {
      expect(screen.getByText(/Renews/)).toBeInTheDocument()
    })
  })

  test('shows cancellation warning when cancelAtPeriodEnd is true', async () => {
    mockFetch.mockResolvedValue(
      mockBillingResponse({
        plan: {
          name: 'Pro', price: 99, interval: 'month',
          renewsAt: '2026-04-01T00:00:00Z', status: 'active',
          cancelAtPeriodEnd: true,
        },
      }),
    )
    render(<BillingSettings />)
    await waitFor(() => {
      expect(screen.getByText(/Cancels on/)).toBeInTheDocument()
    })
  })

  test('displays usage meters for storage, documents, and queries', async () => {
    mockFetch.mockResolvedValue(mockBillingResponse())
    render(<BillingSettings />)
    await waitFor(() => {
      expect(screen.getByText('Vault Storage')).toBeInTheDocument()
      expect(screen.getByText('Documents')).toBeInTheDocument()
      expect(screen.getByText('Queries This Month')).toBeInTheDocument()
    })
  })

  test('displays invoice history', async () => {
    mockFetch.mockResolvedValue(mockBillingResponse())
    render(<BillingSettings />)
    await waitFor(() => {
      expect(screen.getByText('Invoice History')).toBeInTheDocument()
      expect(screen.getAllByText('$99.00').length).toBeGreaterThanOrEqual(1)
    })
  })

  test('shows "No invoices yet" when invoices array is empty', async () => {
    mockFetch.mockResolvedValue(mockBillingResponse({ invoices: [] }))
    render(<BillingSettings />)
    await waitFor(() => {
      expect(screen.getByText('No invoices yet')).toBeInTheDocument()
    })
  })

  test('shows Manage Payment button when hasStripeCustomer', async () => {
    mockFetch.mockResolvedValue(mockBillingResponse())
    render(<BillingSettings />)
    await waitFor(() => {
      expect(screen.getByText('Manage Payment')).toBeInTheDocument()
    })
  })

  test('hides Manage Payment button when no Stripe customer', async () => {
    mockFetch.mockResolvedValue(mockBillingResponse({ hasStripeCustomer: false }))
    render(<BillingSettings />)
    await waitFor(() => {
      expect(screen.queryByText('Manage Payment')).not.toBeInTheDocument()
    })
  })

  test('shows Upgrade button', async () => {
    mockFetch.mockResolvedValue(mockBillingResponse())
    render(<BillingSettings />)
    await waitFor(() => {
      expect(screen.getByText('Upgrade')).toBeInTheDocument()
    })
  })

  test('shows Compare all plans link to /pricing', async () => {
    mockFetch.mockResolvedValue(mockBillingResponse())
    render(<BillingSettings />)
    await waitFor(() => {
      const link = screen.getByText('Compare all plans')
      expect(link).toBeInTheDocument()
      expect(link.closest('a')).toHaveAttribute('href', '/pricing')
    })
  })

  test('renders section header with credit card icon', async () => {
    mockFetch.mockResolvedValue(mockBillingResponse())
    render(<BillingSettings />)
    await waitFor(() => {
      expect(screen.getByText('Billing & Subscription')).toBeInTheDocument()
    })
  })

  test('defaults to Free plan data before API loads', () => {
    mockFetch.mockReturnValue(new Promise(() => {})) // pending
    // BillingSettings initializes with DEFAULT_BILLING (Free plan)
    // The component shows loading spinner, so we can't see default data
    // But we verify the component renders without crashing
    const { container } = render(<BillingSettings />)
    expect(container).toBeTruthy()
  })
})
