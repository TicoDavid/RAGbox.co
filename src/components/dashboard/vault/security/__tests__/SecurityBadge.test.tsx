/**
 * Sarah — S-P0-02: SecurityBadge tests
 */

import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('../SecurityTiers', () => ({
  SECURITY_TIERS: {
    internal: {
      label: 'Internal',
      icon: (props: React.ComponentProps<'svg'>) => <svg data-testid="icon" {...props} />,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      description: 'Internal use',
    },
    sovereign: {
      label: 'Sovereign',
      icon: (props: React.ComponentProps<'svg'>) => <svg data-testid="icon-sovereign" {...props} />,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      glow: 'shadow-red',
      description: 'Maximum security',
    },
  },
}))

import { SecurityBadge } from '../SecurityBadge'

describe('SecurityBadge', () => {
  it('renders label for normal tier', () => {
    render(<SecurityBadge security="internal" />)
    expect(screen.getByText('Internal')).toBeTruthy()
  })

  it('renders sovereign label', () => {
    render(<SecurityBadge security="sovereign" />)
    expect(screen.getByText('Sovereign')).toBeTruthy()
  })

  it('renders large variant with description', () => {
    render(<SecurityBadge security="internal" size="large" />)
    expect(screen.getByText('Internal')).toBeTruthy()
    expect(screen.getByText('Internal use')).toBeTruthy()
  })
})
