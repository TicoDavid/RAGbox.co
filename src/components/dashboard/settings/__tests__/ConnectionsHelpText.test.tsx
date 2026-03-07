/**
 * Sarah — S-P0-02: ConnectionsHelpText tests
 */

import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return { ShieldCheck: icon('shield-check'), Zap: icon('zap'), HelpCircle: icon('help') }
})

import { ConnectionsHelpText } from '../ConnectionsHelpText'

describe('ConnectionsHelpText', () => {
  it('shows "Connect your own AI provider" when not configured', () => {
    render(<ConnectionsHelpText />)
    expect(screen.getByText('Connect your own AI provider')).toBeTruthy()
  })

  it('hides getting started when configured', () => {
    render(<ConnectionsHelpText isConfigured={true} />)
    expect(screen.queryByText('Connect your own AI provider')).toBeNull()
  })

  it('always shows security section', () => {
    render(<ConnectionsHelpText />)
    expect(screen.getByText('Your key is safe')).toBeTruthy()
  })

  it('shows estimated cost section', () => {
    render(<ConnectionsHelpText />)
    expect(screen.getByText('Estimated cost')).toBeTruthy()
  })

  it('shows supported providers list', () => {
    render(<ConnectionsHelpText />)
    expect(screen.getByText(/OpenRouter/)).toBeTruthy()
    expect(screen.getByText(/^OpenAI/)).toBeTruthy()
  })

  it('shows fallback behavior when configured', () => {
    render(<ConnectionsHelpText isConfigured={true} />)
    expect(screen.getByText('Fallback behavior')).toBeTruthy()
  })

  it('includes provider name in cost text', () => {
    render(<ConnectionsHelpText provider="OpenAI" />)
    expect(screen.getByText(/\(OpenAI\)/)).toBeTruthy()
  })
})
