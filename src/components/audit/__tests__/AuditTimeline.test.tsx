/**
 * Sarah — S-P0-02: AuditTimeline tests
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

let mockApiFetchResult: { ok: boolean; json: () => Promise<unknown> }

jest.mock('@/lib/api', () => ({
  apiFetch: jest.fn(() => Promise.resolve(mockApiFetchResult)),
}))

jest.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

jest.mock('framer-motion', () => {
  const FakeMotion = React.forwardRef<HTMLElement, Record<string, unknown>>(
    (props, ref) => {
      const { children, ...rest } = props
      const filtered = Object.fromEntries(
        Object.entries(rest).filter(([k]) => !['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap', 'variants'].includes(k))
      )
      return <div ref={ref as React.Ref<HTMLDivElement>} {...filtered}>{children as React.ReactNode}</div>
    }
  )
  FakeMotion.displayName = 'FakeMotion'
  const fakeButton = React.forwardRef<HTMLButtonElement, Record<string, unknown>>(
    (props, ref) => {
      const { children, ...rest } = props
      const filtered = Object.fromEntries(
        Object.entries(rest).filter(([k]) => !['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap', 'variants'].includes(k))
      )
      return <button ref={ref} {...filtered}>{children as React.ReactNode}</button>
    }
  )
  fakeButton.displayName = 'fakeButton'
  return {
    motion: { div: FakeMotion, button: fakeButton },
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
  }
})

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    Search: icon('search'),
    Filter: icon('filter'),
    Calendar: icon('calendar'),
    ChevronLeft: icon('chevron-left'),
    ChevronRight: icon('chevron-right'),
    RefreshCw: icon('refresh'),
    Download: icon('download'),
    X: icon('x'),
    CheckCircle: icon('check-circle'),
  }
})

jest.mock('../AuditEntry', () => ({
  AuditEntry: ({ event }: { event: { eventId: string; action: string } }) => (
    <div data-testid={`audit-entry-${event.eventId}`}>{event.action}</div>
  ),
  AuditEntryDetailModal: () => <div data-testid="detail-modal" />,
}))

import { AuditTimeline } from '../AuditTimeline'

describe('AuditTimeline', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockApiFetchResult = {
      ok: true,
      json: async () => ({
        logs: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 1, hasMore: false },
      }),
    }
  })

  it('renders search input', async () => {
    render(<AuditTimeline />)
    expect(screen.getByLabelText('Search audit logs')).toBeTruthy()
  })

  it('renders filter toggle button', async () => {
    render(<AuditTimeline />)
    expect(screen.getByLabelText('Toggle filters')).toBeTruthy()
  })

  it('renders refresh button', async () => {
    render(<AuditTimeline />)
    expect(screen.getByLabelText('Refresh audit logs')).toBeTruthy()
  })

  it('shows "All entries verified" text', async () => {
    render(<AuditTimeline />)
    await waitFor(() => {
      expect(screen.getByText('All entries verified')).toBeTruthy()
    })
  })

  it('shows empty state when no logs', async () => {
    render(<AuditTimeline />)
    await waitFor(() => {
      expect(screen.getByText('No audit entries yet')).toBeTruthy()
    })
  })

  it('renders audit entries when logs exist', async () => {
    mockApiFetchResult = {
      ok: true,
      json: async () => ({
        logs: [
          { eventId: 'evt-1', action: 'LOGIN', severity: 'INFO', timestamp: '2026-03-07T10:00:00Z', userId: 'u1', details: {}, detailsHash: 'h1' },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1, hasMore: false },
      }),
    }
    render(<AuditTimeline />)
    await waitFor(() => {
      expect(screen.getByTestId('audit-entry-evt-1')).toBeTruthy()
    })
  })

  it('shows error state on API failure', async () => {
    mockApiFetchResult = {
      ok: false,
      json: async () => ({}),
    }
    render(<AuditTimeline />)
    await waitFor(() => {
      expect(screen.getByText('Failed to fetch audit logs')).toBeTruthy()
    })
  })

  it('shows results count', async () => {
    mockApiFetchResult = {
      ok: true,
      json: async () => ({
        logs: [
          { eventId: 'evt-1', action: 'LOGIN', severity: 'INFO', timestamp: '2026-03-07T10:00:00Z', userId: 'u1', details: {}, detailsHash: 'h1' },
        ],
        pagination: { page: 1, limit: 20, total: 42, totalPages: 3, hasMore: true },
      }),
    }
    render(<AuditTimeline />)
    await waitFor(() => {
      expect(screen.getByText(/Showing 1 of 42 entries/)).toBeTruthy()
    })
  })
})
