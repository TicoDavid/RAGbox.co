/**
 * Sarah — S-P0-02: AuditEntry tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('framer-motion', () => {
  const FakeMotion = React.forwardRef<HTMLDivElement, Record<string, unknown>>(
    (props, ref) => {
      const { children, ...rest } = props
      const filtered = Object.fromEntries(
        Object.entries(rest).filter(([k]) => !['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap', 'variants'].includes(k))
      )
      return <div ref={ref} {...filtered}>{children as React.ReactNode}</div>
    }
  )
  FakeMotion.displayName = 'FakeMotion'
  return {
    motion: { div: FakeMotion },
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
  }
})

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    LogIn: icon('log-in'),
    Upload: icon('upload'),
    MessageSquare: icon('message-square'),
    MessageCircle: icon('message-circle'),
    Shield: icon('shield'),
    Lock: icon('lock'),
    AlertTriangle: icon('alert-triangle'),
    Trash2: icon('trash'),
    LogOut: icon('log-out'),
    Download: icon('download'),
    AlertCircle: icon('alert-circle'),
    ChevronDown: icon('chevron-down'),
    ChevronUp: icon('chevron-up'),
    Hash: icon('hash'),
    Clock: icon('clock'),
    User: icon('user'),
    Globe: icon('globe'),
    CheckCircle: icon('check-circle'),
    X: icon('x'),
  }
})

jest.mock('@/lib/utils', () => ({
  cn: (...args: unknown[]) => args.filter(Boolean).join(' '),
}))

import { AuditEntry, AuditEntryDetailModal } from '../AuditEntry'

const makeEvent = (overrides = {}) => ({
  id: 'evt-abc123456789',
  eventId: 'evt-abc123456789',
  action: 'LOGIN' as const,
  severity: 'INFO' as const,
  timestamp: '2026-03-07T10:30:00Z',
  userId: 'user-123456789012',
  ipAddress: '192.168.1.1',
  details: { method: 'google' },
  resourceType: undefined,
  resourceId: undefined,
  hash: 'sha256-abc123',
  detailsHash: 'sha256-abc123',
  ...overrides,
})

describe('AuditEntry', () => {
  it('renders action display name', () => {
    const onViewDetails = jest.fn()
    render(<AuditEntry event={makeEvent()} index={0} onViewDetails={onViewDetails} />)
    expect(screen.getByText('User Login')).toBeTruthy()
  })

  it('renders timestamp', () => {
    const onViewDetails = jest.fn()
    render(<AuditEntry event={makeEvent()} index={0} onViewDetails={onViewDetails} />)
    // Check date part
    expect(screen.getByText('Mar 7, 2026')).toBeTruthy()
  })

  it('renders summary for LOGIN action', () => {
    const onViewDetails = jest.fn()
    render(<AuditEntry event={makeEvent()} index={0} onViewDetails={onViewDetails} />)
    expect(screen.getByText('Login via google')).toBeTruthy()
  })

  it('renders user ID prefix', () => {
    const onViewDetails = jest.fn()
    render(<AuditEntry event={makeEvent()} index={0} onViewDetails={onViewDetails} />)
    expect(screen.getByText('user-1234567')).toBeTruthy()
  })

  it('renders IP address', () => {
    const onViewDetails = jest.fn()
    render(<AuditEntry event={makeEvent()} index={0} onViewDetails={onViewDetails} />)
    expect(screen.getByText('192.168.1.1')).toBeTruthy()
  })

  it('calls onViewDetails when clicked', () => {
    const onViewDetails = jest.fn()
    const event = makeEvent()
    render(<AuditEntry event={event} index={0} onViewDetails={onViewDetails} />)
    // Click on the entry card area
    fireEvent.click(screen.getByText('User Login').closest('div[class]')!)
    expect(onViewDetails).toHaveBeenCalledWith(event)
  })

  it('shows severity badge for non-INFO events', () => {
    const onViewDetails = jest.fn()
    render(
      <AuditEntry
        event={makeEvent({ severity: 'WARNING' })}
        index={0}
        onViewDetails={onViewDetails}
      />
    )
    expect(screen.getByText('WARNING')).toBeTruthy()
  })

  it('renders DOCUMENT_UPLOAD summary', () => {
    const onViewDetails = jest.fn()
    render(
      <AuditEntry
        event={makeEvent({ action: 'DOCUMENT_UPLOAD', details: { filename: 'report.pdf' } })}
        index={0}
        onViewDetails={onViewDetails}
      />
    )
    expect(screen.getByText('Uploaded "report.pdf"')).toBeTruthy()
  })
})

describe('AuditEntryDetailModal', () => {
  it('returns null when event is null', () => {
    const { container } = render(
      <AuditEntryDetailModal event={null} isOpen={false} onClose={jest.fn()} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders modal with event details', () => {
    const event = makeEvent()
    render(<AuditEntryDetailModal event={event} isOpen={true} onClose={jest.fn()} />)
    expect(screen.getByText('User Login')).toBeTruthy()
    expect(screen.getByText('Integrity Verified')).toBeTruthy()
  })

  it('renders close button', () => {
    const onClose = jest.fn()
    render(<AuditEntryDetailModal event={makeEvent()} isOpen={true} onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('Close audit entry details'))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders event details as JSON', () => {
    const event = makeEvent()
    render(<AuditEntryDetailModal event={event} isOpen={true} onClose={jest.fn()} />)
    expect(screen.getByText('Event Details')).toBeTruthy()
  })
})
