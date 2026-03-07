/**
 * Sarah — S-P0-02: AgentSummaryPanel tests
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'

let mockApiFetchResult: { ok: boolean; json: () => Promise<unknown> }

jest.mock('@/lib/api', () => ({
  apiFetch: jest.fn(() => Promise.resolve(mockApiFetchResult)),
}))

jest.mock('next/link', () => {
  return ({ children, href, ...rest }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...rest}>{children}</a>
  )
})

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    UserCircle: icon('user-circle'),
    ExternalLink: icon('external-link'),
    Loader2: icon('loader'),
  }
})

import { AgentSummaryPanel } from '../AgentSummaryPanel'

describe('AgentSummaryPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockApiFetchResult = { ok: false, json: async () => ({}) }
  })

  it('renders heading', async () => {
    render(<AgentSummaryPanel />)
    expect(screen.getByText('My Agent')).toBeTruthy()
  })

  it('shows no-agent state when API returns no persona', async () => {
    render(<AgentSummaryPanel />)
    await waitFor(() => {
      expect(screen.getByText('No Agent Configured')).toBeTruthy()
    })
  })

  it('shows Set Up Agent link when no agent', async () => {
    render(<AgentSummaryPanel />)
    await waitFor(() => {
      const link = screen.getByText('Set Up Agent')
      expect(link.closest('a')?.getAttribute('href')).toBe('/dashboard/agents')
    })
  })

  it('renders agent name when API returns persona', async () => {
    mockApiFetchResult = {
      ok: true,
      json: async () => ({
        data: {
          persona: {
            id: 'agent-1',
            firstName: 'Evelyn',
            lastName: 'Sov',
            title: 'Legal Analyst',
            greeting: 'How can I help?',
          },
        },
      }),
    }
    render(<AgentSummaryPanel />)
    await waitFor(() => {
      expect(screen.getByText('Evelyn Sov')).toBeTruthy()
    })
  })

  it('renders agent title', async () => {
    mockApiFetchResult = {
      ok: true,
      json: async () => ({
        data: { persona: { id: 'a1', firstName: 'Evelyn', lastName: '', title: 'Analyst', greeting: null } },
      }),
    }
    render(<AgentSummaryPanel />)
    await waitFor(() => {
      expect(screen.getByText('Analyst')).toBeTruthy()
    })
  })

  it('renders agent greeting in quotes', async () => {
    mockApiFetchResult = {
      ok: true,
      json: async () => ({
        data: { persona: { id: 'a1', firstName: 'E', lastName: '', title: null, greeting: 'Hello there' } },
      }),
    }
    render(<AgentSummaryPanel />)
    await waitFor(() => {
      expect(screen.getByText(/Hello there/)).toBeTruthy()
    })
  })

  it('links to agent profile page', async () => {
    mockApiFetchResult = {
      ok: true,
      json: async () => ({
        data: { persona: { id: 'agent-42', firstName: 'E', lastName: '', title: null, greeting: null } },
      }),
    }
    render(<AgentSummaryPanel />)
    await waitFor(() => {
      const link = screen.getByText('Open Agent Profile').closest('a')
      expect(link?.getAttribute('href')).toBe('/dashboard/agents/agent-42')
    })
  })
})
