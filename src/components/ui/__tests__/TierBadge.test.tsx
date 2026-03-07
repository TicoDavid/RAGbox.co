/**
 * Sarah — S-P0-02: TierBadge tests
 */

import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('@/lib/security/tiers', () => ({
  getTierConfig: (tier: number) => ({
    label: `Tier ${tier}`,
    color: tier >= 3 ? '#ef4444' : '#3b82f6',
    glowColor: '#ef444480',
    description: `Security tier ${tier}`,
  }),
}))

import TierBadge from '../TierBadge'

describe('TierBadge', () => {
  it('renders tier label by default', () => {
    render(<TierBadge tier={2} />)
    expect(screen.getByText('T2')).toBeTruthy()
  })

  it('hides label when showLabel is false', () => {
    render(<TierBadge tier={2} showLabel={false} />)
    expect(screen.queryByText('T2')).toBeNull()
  })

  it('sets title from tier description', () => {
    render(<TierBadge tier={3} />)
    const badge = screen.getByTitle('Security tier 3')
    expect(badge).toBeTruthy()
  })

  it('applies small size classes by default', () => {
    const { container } = render(<TierBadge tier={1} />)
    const span = container.firstChild as HTMLElement
    expect(span.className).toContain('text-[10px]')
  })

  it('applies medium size classes', () => {
    const { container } = render(<TierBadge tier={1} size="md" />)
    const span = container.firstChild as HTMLElement
    expect(span.className).toContain('text-xs')
  })

  it('applies large size classes', () => {
    const { container } = render(<TierBadge tier={1} size="lg" />)
    const span = container.firstChild as HTMLElement
    expect(span.className).toContain('text-sm')
  })
})
