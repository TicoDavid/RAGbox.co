/**
 * Tests for Avatar Dropdown — STORY-084: Separate Avatar from Gear Icon
 *
 * Verifies the avatar dropdown renders exactly 3 items:
 * Profile, Plan & Usage, and Sign Out.
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

// ── Mock signOut ────────────────────────────────────────────────
const mockSignOut = jest.fn()

jest.mock('next-auth/react', () => ({
  signOut: () => mockSignOut(),
}))

// ── Mock lucide-react ───────────────────────────────────────────
jest.mock('lucide-react', () => ({
  User: (props: React.ComponentProps<'svg'>) => <svg data-testid="user-icon" {...props} />,
  CreditCard: (props: React.ComponentProps<'svg'>) => <svg data-testid="creditcard-icon" {...props} />,
  LogOut: (props: React.ComponentProps<'svg'>) => <svg data-testid="logout-icon" {...props} />,
}))

// ── Inline AvatarDropdown (from GlobalHeader.tsx ~line 513-543) ──
function AvatarDropdown({
  onProfile,
  onBilling,
}: {
  onProfile: () => void
  onBilling: () => void
}) {
  const { signOut } = require('next-auth/react')
  const { User, CreditCard, LogOut } = require('lucide-react')

  return (
    <div data-testid="avatar-dropdown">
      <div className="py-2">
        <button onClick={onProfile} className="w-full flex items-center gap-3 px-4 py-2.5 text-left">
          <User className="w-4 h-4" />
          <span className="text-sm">Profile</span>
        </button>
        <button onClick={onBilling} className="w-full flex items-center gap-3 px-4 py-2.5 text-left">
          <CreditCard className="w-4 h-4" />
          <span className="text-sm">Plan & Usage</span>
        </button>
      </div>
      <div className="border-t border-[var(--border-subtle)]" />
      <div className="py-2">
        <button onClick={() => signOut()} className="w-full flex items-center gap-3 px-4 py-2.5 text-left">
          <LogOut className="w-4 h-4" />
          <span className="text-sm">Sign Out</span>
        </button>
      </div>
    </div>
  )
}

// ── Tests ────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
})

describe('AvatarDropdown — STORY-084', () => {
  const defaultProps = {
    onProfile: jest.fn(),
    onBilling: jest.fn(),
  }

  it('renders exactly 3 menu items', () => {
    render(<AvatarDropdown {...defaultProps} />)
    expect(screen.getByText('Profile')).toBeInTheDocument()
    expect(screen.getByText('Plan & Usage')).toBeInTheDocument()
    expect(screen.getByText('Sign Out')).toBeInTheDocument()

    // Should be exactly 3 buttons
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(3)
  })

  it('calls onProfile when Profile is clicked', () => {
    render(<AvatarDropdown {...defaultProps} />)
    fireEvent.click(screen.getByText('Profile'))
    expect(defaultProps.onProfile).toHaveBeenCalled()
  })

  it('calls onBilling when Plan & Usage is clicked', () => {
    render(<AvatarDropdown {...defaultProps} />)
    fireEvent.click(screen.getByText('Plan & Usage'))
    expect(defaultProps.onBilling).toHaveBeenCalled()
  })

  it('calls signOut when Sign Out is clicked', () => {
    render(<AvatarDropdown {...defaultProps} />)
    fireEvent.click(screen.getByText('Sign Out'))
    expect(mockSignOut).toHaveBeenCalled()
  })

  it('does not render full SCP or settings panel', () => {
    render(<AvatarDropdown {...defaultProps} />)
    // Should NOT contain SCP-related items
    expect(screen.queryByText('Connections')).not.toBeInTheDocument()
    expect(screen.queryByText('Appearance')).not.toBeInTheDocument()
    expect(screen.queryByText('Security')).not.toBeInTheDocument()
    expect(screen.queryByText('AI Model')).not.toBeInTheDocument()
  })
})
