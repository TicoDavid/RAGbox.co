/**
 * Sarah — S-P0-02: Navbar tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('next/link', () => {
  return ({ children, href }: React.PropsWithChildren<{ href: string }>) => <a href={href}>{children}</a>
})

jest.mock('next/image', () => {
  return (props: { alt: string; src: string }) => <img alt={props.alt} src={props.src} />
})

jest.mock('next-themes', () => ({
  useTheme: () => ({ setTheme: jest.fn(), resolvedTheme: 'dark' }),
}))

jest.mock('framer-motion', () => {
  const FakeMotion = React.forwardRef<HTMLElement, Record<string, unknown>>(
    (props, ref) => {
      const { children, ...rest } = props
      const filtered = Object.fromEntries(
        Object.entries(rest).filter(([k]) => !['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap', 'variants', 'viewport', 'whileInView'].includes(k))
      )
      return <div ref={ref as React.Ref<HTMLDivElement>} {...filtered}>{children as React.ReactNode}</div>
    }
  )
  FakeMotion.displayName = 'FakeMotion'
  const FakeA = React.forwardRef<HTMLAnchorElement, Record<string, unknown>>(
    (props, ref) => {
      const { children, ...rest } = props
      const filtered = Object.fromEntries(
        Object.entries(rest).filter(([k]) => !['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap'].includes(k))
      )
      return <a ref={ref} {...filtered}>{children as React.ReactNode}</a>
    }
  )
  FakeA.displayName = 'FakeA'
  const FakeButton = React.forwardRef<HTMLButtonElement, Record<string, unknown>>(
    (props, ref) => {
      const { children, ...rest } = props
      const filtered = Object.fromEntries(
        Object.entries(rest).filter(([k]) => !['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap'].includes(k))
      )
      return <button ref={ref} {...filtered}>{children as React.ReactNode}</button>
    }
  )
  FakeButton.displayName = 'FakeButton'
  return {
    motion: { div: FakeMotion, button: FakeButton, a: FakeA },
    AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
  }
})

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return { Sun: icon('sun'), Moon: icon('moon') }
})

jest.mock('@/lib/utils', () => ({ cn: (...args: unknown[]) => args.filter(Boolean).join(' ') }))

import { Navbar } from '../Navbar'

describe('Navbar', () => {
  it('renders RAGbox logo', () => {
    render(<Navbar />)
    expect(screen.getByAltText('RAGbox')).toBeTruthy()
  })

  it('renders Pricing link', () => {
    render(<Navbar />)
    expect(screen.getByText('Pricing')).toBeTruthy()
  })

  it('renders Sign In button', () => {
    render(<Navbar />)
    expect(screen.getByText('Sign In')).toBeTruthy()
  })

  it('calls onOpenAuth when Sign In clicked', () => {
    const onOpenAuth = jest.fn()
    render(<Navbar onOpenAuth={onOpenAuth} />)
    fireEvent.click(screen.getByText('Sign In'))
    expect(onOpenAuth).toHaveBeenCalled()
  })

  it('renders Request Demo link', () => {
    render(<Navbar />)
    expect(screen.getByText('Request Demo')).toBeTruthy()
  })

  it('renders theme toggle button', () => {
    render(<Navbar />)
    expect(screen.getByLabelText('Toggle theme')).toBeTruthy()
  })
})
