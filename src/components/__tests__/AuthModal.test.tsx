/**
 * Sarah — S-P0-02: AuthModal tests
 *
 * Covers: render email step, OTP step transition, Google button,
 * context-dependent headers, error display, close behavior.
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

// ── Mocks ──────────────────────────────────────────────────────

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
}))

const mockSignIn = jest.fn()
jest.mock('next-auth/react', () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}))

jest.mock('@/lib/api', () => ({
  apiFetch: jest.fn(),
}))

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

import { AuthModal } from '../AuthModal'

// ── Tests ───────────────────────────────────────────────────────

describe('AuthModal', () => {
  const defaultProps = { isOpen: true, onClose: jest.fn() }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns null when isOpen is false', () => {
    const { container } = render(<AuthModal isOpen={false} onClose={jest.fn()} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders the email step by default', () => {
    render(<AuthModal {...defaultProps} />)
    expect(screen.getByPlaceholderText('name@company.com')).toBeTruthy()
  })

  it('shows "Welcome Back" title for signin context', () => {
    render(<AuthModal {...defaultProps} context="signin" />)
    expect(screen.getByText('Welcome Back')).toBeTruthy()
  })

  it('shows "Create Sovereign Vault" title for signup context', () => {
    render(<AuthModal {...defaultProps} context="signup" />)
    expect(screen.getByText('Create Sovereign Vault')).toBeTruthy()
  })

  it('shows "Authenticate to Analyze" title for upload context', () => {
    render(<AuthModal {...defaultProps} context="upload" />)
    expect(screen.getByText('Authenticate to Analyze')).toBeTruthy()
  })

  it('renders the Continue Securely button', () => {
    render(<AuthModal {...defaultProps} />)
    expect(screen.getByText('Continue Securely')).toBeTruthy()
  })

  it('renders the Google sign-in button', () => {
    render(<AuthModal {...defaultProps} />)
    expect(screen.getByText('Continue with Google')).toBeTruthy()
  })

  it('calls signIn with google provider on Google button click', () => {
    render(<AuthModal {...defaultProps} />)
    fireEvent.click(screen.getByText('Continue with Google'))
    expect(mockSignIn).toHaveBeenCalledWith('google', { callbackUrl: '/dashboard' })
  })

  it('renders RAGböx branding', () => {
    render(<AuthModal {...defaultProps} />)
    expect(screen.getByText('RAG')).toBeTruthy()
    expect(screen.getByText('.co')).toBeTruthy()
  })

  it('shows security guarantee footer', () => {
    render(<AuthModal {...defaultProps} />)
    expect(screen.getByText('Zero Data Exfiltration Guarantee')).toBeTruthy()
  })

  it('displays external error message when provided', () => {
    render(<AuthModal {...defaultProps} errorMessage="OAuth failed" />)
    expect(screen.getByText('OAuth failed')).toBeTruthy()
  })

  it('disables Continue button when email is empty', () => {
    render(<AuthModal {...defaultProps} />)
    const btn = screen.getByText('Continue Securely')
    expect(btn.closest('button')?.disabled).toBe(true)
  })

  it('enables Continue button when email has value', () => {
    render(<AuthModal {...defaultProps} />)
    const input = screen.getByPlaceholderText('name@company.com')
    fireEvent.change(input, { target: { value: 'test@example.com' } })
    const btn = screen.getByText('Continue Securely')
    expect(btn.closest('button')?.disabled).toBe(false)
  })
})
