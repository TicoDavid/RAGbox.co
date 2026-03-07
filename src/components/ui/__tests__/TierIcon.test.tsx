/**
 * Sarah — S-P0-02: TierIcon tests
 */

import React from 'react'
import { render } from '@testing-library/react'

jest.mock('@/lib/security/tiers', () => ({
  getTierConfig: (tier: number) => ({
    color: tier === 0 ? '#999' : '#f00',
  }),
}))

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    ({ size, style, ...props }: { size?: number; style?: React.CSSProperties } & React.ComponentProps<'svg'>) => (
      <svg data-testid={`icon-${name}`} data-size={size} style={style} {...props} />
    )
  return {
    Upload: icon('upload'),
    FileText: icon('filetext'),
    Shield: icon('shield'),
    Lock: icon('lock'),
    ShieldAlert: icon('shieldalert'),
  }
})

import TierIcon from '../TierIcon'

describe('TierIcon', () => {
  it('renders Upload icon for tier 0', () => {
    const { container } = render(<TierIcon tier={0} />)
    expect(container.querySelector('[data-testid="icon-upload"]')).toBeTruthy()
  })

  it('renders FileText icon for tier 1', () => {
    const { container } = render(<TierIcon tier={1} />)
    expect(container.querySelector('[data-testid="icon-filetext"]')).toBeTruthy()
  })

  it('renders Shield icon for tier 2', () => {
    const { container } = render(<TierIcon tier={2} />)
    expect(container.querySelector('[data-testid="icon-shield"]')).toBeTruthy()
  })

  it('renders Lock icon for tier 3', () => {
    const { container } = render(<TierIcon tier={3} />)
    expect(container.querySelector('[data-testid="icon-lock"]')).toBeTruthy()
  })

  it('renders ShieldAlert icon for tier 4', () => {
    const { container } = render(<TierIcon tier={4} />)
    expect(container.querySelector('[data-testid="icon-shieldalert"]')).toBeTruthy()
  })

  it('uses default size of 16', () => {
    const { container } = render(<TierIcon tier={0} />)
    expect(container.querySelector('svg')?.getAttribute('data-size')).toBe('16')
  })

  it('applies custom size', () => {
    const { container } = render(<TierIcon tier={0} size={24} />)
    expect(container.querySelector('svg')?.getAttribute('data-size')).toBe('24')
  })
})
