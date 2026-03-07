/**
 * Sarah — S-P0-02: SupportSettings tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    Zap: icon('zap'), FileText: icon('file-text'), Shield: icon('shield'),
    Sparkles: icon('sparkles'), Server: icon('server'), ExternalLink: icon('ext'),
    Users: icon('users'), MessageSquare: icon('message'), Loader2: icon('loader'),
  }
})

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

jest.mock('../shared', () => ({
  SectionHeader: ({ title }: { title: string }) => <h3 data-testid="section-header">{title}</h3>,
}))

import { DocumentationSettings, ReportIssueSettings } from '../SupportSettings'

describe('DocumentationSettings', () => {
  it('renders Documentation title', () => {
    render(<DocumentationSettings />)
    expect(screen.getByText('Documentation')).toBeTruthy()
  })

  it('renders doc links', () => {
    render(<DocumentationSettings />)
    expect(screen.getByText('Protocol Alpha: Initialization')).toBeTruthy()
    expect(screen.getByText('The Sovereign Uplink (API)')).toBeTruthy()
    expect(screen.getByText('The Fortress Architecture')).toBeTruthy()
  })
})

describe('ReportIssueSettings', () => {
  it('renders Report Issue title', () => {
    render(<ReportIssueSettings />)
    expect(screen.getByText('Report Issue')).toBeTruthy()
  })

  it('renders issue type buttons', () => {
    render(<ReportIssueSettings />)
    expect(screen.getByText('bug')).toBeTruthy()
    expect(screen.getByText('feature')).toBeTruthy()
    expect(screen.getByText('question')).toBeTruthy()
  })

  it('renders Submit Report button', () => {
    render(<ReportIssueSettings />)
    expect(screen.getByText('Submit Report')).toBeTruthy()
  })
})
