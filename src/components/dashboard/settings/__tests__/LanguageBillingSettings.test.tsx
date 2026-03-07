/**
 * Sarah — S-P0-02: LanguageBillingSettings tests
 */

import React from 'react'
import { render, screen, act } from '@testing-library/react'

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return { Check: icon('check'), CreditCard: icon('credit'), Zap: icon('zap'), ExternalLink: icon('ext') }
})

jest.mock('sonner', () => ({ toast: { error: jest.fn() } }))

jest.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({
    language: 'en',
    setLanguage: jest.fn(),
  }),
  LANGUAGES: {
    en: { name: 'English', nativeName: 'English' },
    es: { name: 'Spanish', nativeName: 'Español' },
  },
}))

jest.mock('../shared', () => ({
  SectionHeader: ({ title }: { title: string }) => <h3>{title}</h3>,
}))

import { LanguageSettings, BillingSettings } from '../LanguageBillingSettings'

describe('LanguageSettings', () => {
  it('renders Sovereign Language heading', () => {
    render(<LanguageSettings />)
    expect(screen.getByText('Sovereign Language')).toBeTruthy()
  })

  it('renders language options', () => {
    render(<LanguageSettings />)
    expect(screen.getAllByText('English').length).toBeGreaterThan(0)
    expect(screen.getByText('Spanish')).toBeTruthy()
  })
})

describe('BillingSettings', () => {
  beforeEach(() => {
    global.fetch = jest.fn(() =>
      Promise.resolve({ json: () => Promise.resolve({ data: { subscriptionTier: 'starter' } }) })
    ) as jest.Mock
  })

  it('renders Plan & Usage heading', async () => {
    await act(async () => {
      render(<BillingSettings />)
    })
    expect(screen.getByText('Plan & Usage')).toBeTruthy()
  })

  it('renders Manage Subscription button', async () => {
    await act(async () => {
      render(<BillingSettings />)
    })
    expect(screen.getByText('Manage Subscription')).toBeTruthy()
  })
})
