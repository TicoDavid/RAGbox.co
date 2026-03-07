/**
 * Sarah — S-P0-02: TheBox tests
 */

import React from 'react'
import { render, screen } from '@testing-library/react'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

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
  const FakeSvg = React.forwardRef<SVGSVGElement, Record<string, unknown>>(
    (props, ref) => {
      const { children, ...rest } = props
      const filtered = Object.fromEntries(
        Object.entries(rest).filter(([k]) => !['initial', 'animate', 'exit', 'transition', 'variants'].includes(k))
      )
      return <svg ref={ref} {...filtered}>{children as React.ReactNode}</svg>
    }
  )
  FakeSvg.displayName = 'FakeSvg'
  const FakePath = React.forwardRef<SVGPathElement, Record<string, unknown>>(
    (props, ref) => {
      const filtered = Object.fromEntries(
        Object.entries(props).filter(([k]) => !['initial', 'animate', 'exit', 'transition'].includes(k))
      )
      return <path ref={ref} {...filtered} />
    }
  )
  FakePath.displayName = 'FakePath'
  return {
    motion: { div: FakeMotion, svg: FakeSvg, path: FakePath, p: FakeMotion },
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
  }
})

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return { Upload: icon('upload'), Box: icon('box'), Check: icon('check') }
})

jest.mock('@/lib/utils', () => ({ cn: (...args: unknown[]) => args.filter(Boolean).join(' ') }))
jest.mock('@/hooks/useRagSounds', () => ({ useRagSounds: () => ({ playDropSound: jest.fn() }) }))

import { TheBox } from '../TheBox'

describe('TheBox', () => {
  it('renders "Feed the Vault" text', () => {
    render(<TheBox />)
    expect(screen.getByText('Feed the Vault')).toBeTruthy()
  })

  it('renders instruction text', () => {
    render(<TheBox />)
    expect(screen.getByText('Drag documents here or click to browse')).toBeTruthy()
  })
})
