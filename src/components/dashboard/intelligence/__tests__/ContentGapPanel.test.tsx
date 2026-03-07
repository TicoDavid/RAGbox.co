/**
 * Sarah — S-P0-02: ContentGapPanel tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return { AlertTriangle: icon('alert'), X: icon('x'), CheckCircle2: icon('check') }
})

const mockStore = {
  gaps: [] as Array<{ id: string; queryText: string; confidenceScore: number; createdAt: string; suggestedTopics: string[] }>,
  gapSummary: null as { openGaps: number } | null,
  gapsLoading: false,
  fetchGaps: jest.fn(),
  dismissGap: jest.fn(),
  addressGap: jest.fn(),
}

jest.mock('@/stores/contentIntelligenceStore', () => ({
  useContentIntelligenceStore: (sel: (s: typeof mockStore) => unknown) => sel(mockStore),
}))

import { ContentGapPanel } from '../ContentGapPanel'

describe('ContentGapPanel', () => {
  beforeEach(() => {
    mockStore.gaps = []
    mockStore.gapSummary = null
    mockStore.gapsLoading = false
    jest.clearAllMocks()
  })

  it('renders Knowledge Gaps heading', () => {
    render(<ContentGapPanel />)
    expect(screen.getByText('Knowledge Gaps')).toBeTruthy()
  })

  it('calls fetchGaps on mount', () => {
    render(<ContentGapPanel />)
    expect(mockStore.fetchGaps).toHaveBeenCalled()
  })

  it('shows empty state when no gaps', () => {
    render(<ContentGapPanel />)
    expect(screen.getByText(/No knowledge gaps detected/)).toBeTruthy()
  })

  it('renders gap query text', () => {
    mockStore.gaps = [
      { id: 'g1', queryText: 'What is the retention policy?', confidenceScore: 0.4, createdAt: new Date().toISOString(), suggestedTopics: [] },
    ]
    render(<ContentGapPanel />)
    expect(screen.getByText('What is the retention policy?')).toBeTruthy()
  })

  it('renders suggested topics as chips', () => {
    mockStore.gaps = [
      { id: 'g1', queryText: 'Q?', confidenceScore: 0.3, createdAt: new Date().toISOString(), suggestedTopics: ['retention', 'compliance'] },
    ]
    render(<ContentGapPanel />)
    expect(screen.getByText('retention')).toBeTruthy()
    expect(screen.getByText('compliance')).toBeTruthy()
  })

  it('calls dismissGap on Dismiss click', () => {
    mockStore.gaps = [
      { id: 'g1', queryText: 'Q?', confidenceScore: 0.3, createdAt: new Date().toISOString(), suggestedTopics: [] },
    ]
    render(<ContentGapPanel />)
    fireEvent.click(screen.getByText('Dismiss'))
    expect(mockStore.dismissGap).toHaveBeenCalledWith('g1')
  })

  it('calls addressGap on Addressed click', () => {
    mockStore.gaps = [
      { id: 'g1', queryText: 'Q?', confidenceScore: 0.3, createdAt: new Date().toISOString(), suggestedTopics: [] },
    ]
    render(<ContentGapPanel />)
    fireEvent.click(screen.getByText('Addressed'))
    expect(mockStore.addressGap).toHaveBeenCalledWith('g1')
  })
})
