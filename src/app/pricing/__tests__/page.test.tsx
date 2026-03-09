/**
 * Sarah — EPIC-031 T5: Pricing Page Tests
 *
 * Tests tier card rendering, annual/monthly toggle, pricing values,
 * feature comparison table, and checkout behavior.
 */

// ── Mocks ────────────────────────────────────────────────────────

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(() => ({ data: null, status: 'unauthenticated' })),
}))

jest.mock('@/hooks/useSubscriptionTier', () => ({
  useSubscriptionTier: jest.fn(() => ({ tier: null, loading: false })),
}))

jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => {
      const { initial, whileInView, viewport, transition, animate, exit, layoutId, ...rest } = props
      return <div {...rest}>{children}</div>
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

jest.mock('@/components/Navbar', () => ({
  Navbar: () => <nav data-testid="navbar" />,
}))

jest.mock('@/components/Footer', () => ({
  __esModule: true,
  default: () => <footer data-testid="footer" />,
}))

jest.mock('@/components/pricing/PricingFAQ', () => ({
  PricingFAQ: () => <div data-testid="pricing-faq" />,
}))

jest.mock('@/components/pricing/FeatureComparisonTable', () => ({
  FeatureComparisonTable: () => <table data-testid="feature-table" />,
}))

// ── Imports ──────────────────────────────────────────────────────

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import PricingPage from '../page'
import { TIERS } from '@/components/pricing/tierData'

// ── Tests ────────────────────────────────────────────────────────

describe('Sarah — EPIC-031 T5: Pricing Page', () => {
  test('renders all 5 tier cards', () => {
    render(<PricingPage />)
    for (const tier of TIERS) {
      expect(screen.getByText(tier.name)).toBeInTheDocument()
    }
  })

  test('renders hero heading', () => {
    render(<PricingPage />)
    expect(screen.getByText('Simple, Transparent Pricing')).toBeInTheDocument()
  })

  test('renders pricing toggle with Monthly and Annual', () => {
    render(<PricingPage />)
    expect(screen.getByText('Monthly')).toBeInTheDocument()
    expect(screen.getByText('Annual')).toBeInTheDocument()
  })

  test('shows monthly prices by default', () => {
    render(<PricingPage />)
    // Starter = $29/month
    expect(screen.getByText('$29')).toBeInTheDocument()
    // Pro = $99/month
    expect(screen.getByText('$99')).toBeInTheDocument()
    // Business = $249/month
    expect(screen.getByText('$249')).toBeInTheDocument()
  })

  test('shows annual prices after toggle', () => {
    render(<PricingPage />)
    fireEvent.click(screen.getByText('Annual'))
    // Starter annual = $23/mo
    expect(screen.getByText('$23')).toBeInTheDocument()
    // Pro annual = $79/mo
    expect(screen.getByText('$79')).toBeInTheDocument()
    // Business annual = $199/mo
    expect(screen.getByText('$199')).toBeInTheDocument()
  })

  test('Pro tier has "Most Popular" badge', () => {
    render(<PricingPage />)
    expect(screen.getByText('Most Popular')).toBeInTheDocument()
  })

  test('AI Team tier shows "Contact Sales" CTA', () => {
    render(<PricingPage />)
    expect(screen.getByText('Contact Sales')).toBeInTheDocument()
  })

  test('renders feature comparison table', () => {
    render(<PricingPage />)
    expect(screen.getByTestId('feature-table')).toBeInTheDocument()
  })

  test('renders FAQ section', () => {
    render(<PricingPage />)
    expect(screen.getByTestId('pricing-faq')).toBeInTheDocument()
  })

  test('renders trust bar with compliance badges', () => {
    render(<PricingPage />)
    expect(screen.getByText(/SOC2 Ready/)).toBeInTheDocument()
    expect(screen.getByText(/AES-256 Encrypted/)).toBeInTheDocument()
  })

  test('renders free trial CTA section', () => {
    render(<PricingPage />)
    expect(screen.getByText('Start your free trial today')).toBeInTheDocument()
    expect(screen.getByText('14 days free on any plan. No credit card required.')).toBeInTheDocument()
  })

  test('renders navbar and footer', () => {
    render(<PricingPage />)
    expect(screen.getByTestId('navbar')).toBeInTheDocument()
    expect(screen.getByTestId('footer')).toBeInTheDocument()
  })
})
