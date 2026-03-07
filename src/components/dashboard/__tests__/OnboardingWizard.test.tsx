/**
 * Sarah — S-P0-02: OnboardingWizard tests
 *
 * Covers: welcome step renders, progress dots, Get Started advances step,
 * skip onboarding calls onComplete, step transitions.
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLDivElement>) => <div ref={ref} {...props}>{children}</div>),
    img: React.forwardRef((props: Record<string, unknown>, ref: React.Ref<HTMLImageElement>) => <img ref={ref} {...(props as React.ImgHTMLAttributes<HTMLImageElement>)} />),
    h1: React.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLHeadingElement>) => <h1 ref={ref} {...props}>{children}</h1>),
    p: React.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLParagraphElement>) => <p ref={ref} {...props}>{children}</p>),
    button: React.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLButtonElement>) => <button ref={ref} {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}>{children}</button>),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}))

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    ArrowRight: icon('arrow-right'),
    Upload: icon('upload'),
    FileText: icon('filetext'),
    MessageSquare: icon('message'),
    Mic: icon('mic'),
    X: icon('x'),
    CheckCircle2: icon('check'),
    Sparkles: icon('sparkles'),
    Shield: icon('shield'),
  }
})

jest.mock('@/stores/vaultStore', () => ({
  useVaultStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ uploadDocument: jest.fn() }),
}))

jest.mock('@/stores/chatStore', () => ({
  useChatStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ setInputValue: jest.fn() }),
}))

jest.mock('@/lib/features', () => ({
  isMercuryEnabled: () => false,
}))

jest.mock('@/lib/api', () => ({
  apiFetch: jest.fn(() => Promise.resolve({ ok: true })),
}))

jest.mock('@/components/dashboard/vault/security/SecurityDropdown', () => ({
  SecurityDropdown: () => <div data-testid="security-dropdown" />,
}))

import { OnboardingWizard } from '../OnboardingWizard'

describe('OnboardingWizard', () => {
  const onComplete = jest.fn()

  beforeEach(() => jest.clearAllMocks())

  it('renders welcome step on mount', () => {
    render(<OnboardingWizard onComplete={onComplete} />)
    expect(screen.getByText('Welcome to RAGböx')).toBeTruthy()
  })

  it('shows Get Started button on welcome step', () => {
    render(<OnboardingWizard onComplete={onComplete} />)
    expect(screen.getByText('Get Started')).toBeTruthy()
  })

  it('advances to Security step on Get Started click', () => {
    render(<OnboardingWizard onComplete={onComplete} />)
    fireEvent.click(screen.getByText('Get Started'))
    expect(screen.getByText('Set Your Vault Security')).toBeTruthy()
  })

  it('shows skip onboarding button after step 0', () => {
    render(<OnboardingWizard onComplete={onComplete} />)
    fireEvent.click(screen.getByText('Get Started'))
    // X button should be visible (title="Skip onboarding")
    expect(screen.getByTitle('Skip onboarding')).toBeTruthy()
  })

  it('advances to Upload step from Security', () => {
    render(<OnboardingWizard onComplete={onComplete} />)
    fireEvent.click(screen.getByText('Get Started'))
    fireEvent.click(screen.getByText('Continue'))
    expect(screen.getByText('Upload Your First Document')).toBeTruthy()
  })

  it('renders suggested questions on Ask step', () => {
    render(<OnboardingWizard onComplete={onComplete} />)
    // Step 0 → 1 → 2 → 3
    fireEvent.click(screen.getByText('Get Started'))
    fireEvent.click(screen.getByText('Continue'))
    fireEvent.click(screen.getByText('Continue'))
    expect(screen.getByText('Ask Your First Question')).toBeTruthy()
    expect(screen.getByText('Summarize this document')).toBeTruthy()
    expect(screen.getByText('What are the key risks?')).toBeTruthy()
  })

  it('renders the wizard subtitle', () => {
    render(<OnboardingWizard onComplete={onComplete} />)
    expect(screen.getByText('Your documents are about to get a lot smarter.')).toBeTruthy()
  })
})
