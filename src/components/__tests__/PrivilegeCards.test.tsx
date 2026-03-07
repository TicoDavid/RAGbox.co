/**
 * Sarah — S-P0-02: PrivilegeCards tests
 */

import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('framer-motion', () => {
  const FakeMotion = React.forwardRef<HTMLDivElement, Record<string, unknown>>(
    (props, ref) => {
      const { children, ...rest } = props
      const filtered = Object.fromEntries(
        Object.entries(rest).filter(([k]) => !['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap', 'variants', 'viewport', 'whileInView'].includes(k))
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
    BrainCircuit: icon('brain'),
    ToggleRight: icon('toggle'),
    ShieldBan: icon('shield-ban'),
    ScrollText: icon('scroll'),
  }
})

jest.mock('@/lib/utils', () => ({ cn: (...args: unknown[]) => args.filter(Boolean).join(' ') }))

import { PrivilegeCards } from '../PrivilegeCards'

describe('PrivilegeCards', () => {
  it('renders section heading', () => {
    render(<PrivilegeCards />)
    expect(screen.getByText('Your Files Speak.')).toBeTruthy()
  })

  it('renders 4 pillar titles', () => {
    render(<PrivilegeCards />)
    expect(screen.getByText('The Silence Protocol')).toBeTruthy()
    expect(screen.getByText('The Privilege Switch')).toBeTruthy()
    expect(screen.getByText('Digital Fort Knox')).toBeTruthy()
    expect(screen.getByText('The Unalterable Record')).toBeTruthy()
  })

  it('renders pillar tags', () => {
    render(<PrivilegeCards />)
    expect(screen.getByText('Anti-Hallucination')).toBeTruthy()
    expect(screen.getByText('Role-Based')).toBeTruthy()
    expect(screen.getByText('Zero-Retention')).toBeTruthy()
    expect(screen.getByText('Veritas Protocol')).toBeTruthy()
  })
})
