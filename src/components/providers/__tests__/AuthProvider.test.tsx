/**
 * Sarah — S-P0-02: AuthProvider tests
 *
 * Covers: wraps children in SessionProvider, passes correct props.
 */

import React from 'react'
import { render, screen } from '@testing-library/react'

// ── Mock next-auth/react ────────────────────────────────────────
let capturedProps: Record<string, unknown> = {}

jest.mock('next-auth/react', () => ({
  SessionProvider: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    capturedProps = props
    return <div data-testid="session-provider">{children}</div>
  },
}))

import { AuthProvider } from '../AuthProvider'

describe('AuthProvider', () => {
  beforeEach(() => {
    capturedProps = {}
  })

  it('renders children inside SessionProvider', () => {
    render(
      <AuthProvider>
        <span data-testid="child">Hello</span>
      </AuthProvider>
    )
    expect(screen.getByTestId('session-provider')).toBeTruthy()
    expect(screen.getByTestId('child')).toBeTruthy()
  })

  it('sets refetchInterval to 300 seconds (5 min)', () => {
    render(<AuthProvider><div /></AuthProvider>)
    expect(capturedProps.refetchInterval).toBe(300)
  })

  it('disables refetchOnWindowFocus', () => {
    render(<AuthProvider><div /></AuthProvider>)
    expect(capturedProps.refetchOnWindowFocus).toBe(false)
  })
})
