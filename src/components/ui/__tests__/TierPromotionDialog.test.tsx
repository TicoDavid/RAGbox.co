/**
 * Sarah — S-P0-02: TierPromotionDialog tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    X: icon('x'),
    ArrowUp: icon('arrow-up'),
    ArrowDown: icon('arrow-down'),
    Shield: icon('shield'),
  }
})

jest.mock('@/lib/security/tiers', () => ({
  getTierConfig: (tier: number) => ({
    label: `Tier ${tier}`,
    description: `Description for tier ${tier}`,
    color: '#000',
  }),
  canPromote: (from: number, to: number) => to > from,
  canDemote: (from: number, to: number) => to < from,
}))

jest.mock('../TierBadge', () => {
  return ({ tier }: { tier: number }) => <span data-testid={`tier-badge-${tier}`}>Tier {tier}</span>
})

import TierPromotionDialog from '../TierPromotionDialog'

describe('TierPromotionDialog', () => {
  const baseProps = {
    documentId: 'doc-1',
    documentName: 'contract.pdf',
    currentTier: 2,
    isOpen: true,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
  }

  beforeEach(() => jest.clearAllMocks())

  it('returns null when not open', () => {
    const { container } = render(<TierPromotionDialog {...baseProps} isOpen={false} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders dialog title', () => {
    render(<TierPromotionDialog {...baseProps} />)
    expect(screen.getByText('Change Security Tier')).toBeTruthy()
  })

  it('shows document name', () => {
    render(<TierPromotionDialog {...baseProps} />)
    expect(screen.getByText('contract.pdf')).toBeTruthy()
  })

  it('renders tier options (excluding current tier)', () => {
    render(<TierPromotionDialog {...baseProps} />)
    // Tiers 0,1,3,4 are options (current is 2)
    expect(screen.getByTestId('tier-badge-0')).toBeTruthy()
    expect(screen.getByTestId('tier-badge-1')).toBeTruthy()
    expect(screen.getByTestId('tier-badge-3')).toBeTruthy()
    expect(screen.getByTestId('tier-badge-4')).toBeTruthy()
  })

  it('calls onClose when Cancel clicked', () => {
    render(<TierPromotionDialog {...baseProps} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(baseProps.onClose).toHaveBeenCalled()
  })

  it('Confirm button is disabled when no tier selected', () => {
    render(<TierPromotionDialog {...baseProps} />)
    expect(screen.getByText('Confirm')).toBeDisabled()
  })
})
