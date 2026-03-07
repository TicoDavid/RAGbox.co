/**
 * Sarah — S-P0-02: ThemeProvider tests
 */

import React from 'react'
import { render, screen } from '@testing-library/react'

let capturedProps: Record<string, unknown> = {}

jest.mock('next-themes', () => ({
  ThemeProvider: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    capturedProps = props
    return <div data-testid="theme-provider">{children}</div>
  },
}))

import { ThemeProvider } from '../ThemeProvider'

describe('ThemeProvider', () => {
  beforeEach(() => { capturedProps = {} })

  it('renders children', () => {
    render(<ThemeProvider><span>App</span></ThemeProvider>)
    expect(screen.getByText('App')).toBeTruthy()
  })

  it('sets attribute to "class"', () => {
    render(<ThemeProvider><div /></ThemeProvider>)
    expect(capturedProps.attribute).toBe('class')
  })

  it('sets defaultTheme to "dark"', () => {
    render(<ThemeProvider><div /></ThemeProvider>)
    expect(capturedProps.defaultTheme).toBe('dark')
  })

  it('enables system theme detection', () => {
    render(<ThemeProvider><div /></ThemeProvider>)
    expect(capturedProps.enableSystem).toBe(true)
  })
})
