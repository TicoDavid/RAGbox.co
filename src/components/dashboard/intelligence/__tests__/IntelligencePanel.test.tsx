/**
 * Sarah — S-P0-02: IntelligencePanel tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return { BrainCircuit: icon('brain') }
})

const mockStore = {
  gaps: [] as unknown[],
  healthChecks: [] as unknown[],
  gapsLoading: false,
  healthLoading: false,
}

jest.mock('@/stores/contentIntelligenceStore', () => ({
  useContentIntelligenceStore: (sel: (s: typeof mockStore) => unknown) => sel(mockStore),
}))

jest.mock('../ContentGapPanel', () => ({
  ContentGapPanel: () => <div data-testid="content-gap-panel">ContentGapPanel</div>,
}))

jest.mock('../KBHealthPanel', () => ({
  KBHealthPanel: () => <div data-testid="kb-health-panel">KBHealthPanel</div>,
}))

import { IntelligencePanel } from '../IntelligencePanel'

describe('IntelligencePanel', () => {
  beforeEach(() => {
    mockStore.gaps = []
    mockStore.healthChecks = []
    mockStore.gapsLoading = false
    mockStore.healthLoading = false
  })

  it('shows empty state when idle', () => {
    render(<IntelligencePanel />)
    expect(screen.getByText('Intelligence Idle')).toBeTruthy()
  })

  it('shows tab bar when data exists', () => {
    mockStore.gaps = [{ id: 'g1' }]
    render(<IntelligencePanel />)
    expect(screen.getByText('Knowledge Gaps')).toBeTruthy()
    expect(screen.getByText('KB Health')).toBeTruthy()
  })

  it('renders ContentGapPanel by default', () => {
    mockStore.gaps = [{ id: 'g1' }]
    render(<IntelligencePanel />)
    expect(screen.getByTestId('content-gap-panel')).toBeTruthy()
  })

  it('switches to KBHealthPanel on tab click', () => {
    mockStore.gaps = [{ id: 'g1' }]
    render(<IntelligencePanel />)
    fireEvent.click(screen.getByText('KB Health'))
    expect(screen.getByTestId('kb-health-panel')).toBeTruthy()
  })
})
