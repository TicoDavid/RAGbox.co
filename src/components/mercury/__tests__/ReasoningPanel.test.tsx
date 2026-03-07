/**
 * Sarah — S-P0-02: ReasoningPanel tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return { ChevronDown: icon('chevron-down'), ChevronRight: icon('chevron-right'), Brain: icon('brain') }
})

jest.mock('../ReasoningStep', () => {
  return ({ step }: { step: { id: string; label: string } }) => <div data-testid={`step-${step.id}`}>{step.label}</div>
})

jest.mock('../ConfidenceBadge', () => {
  return ({ confidence }: { confidence: number }) => <span data-testid="confidence">{Math.round(confidence * 100)}%</span>
})

import ReasoningPanel from '../ReasoningPanel'

const mockTrace = {
  id: 'trace-001',
  queryId: 'query-001',
  steps: [
    { id: 's1', label: 'Retrieve', description: 'Fetching chunks', status: 'complete' as const, durationMs: 120 },
    { id: 's2', label: 'Generate', description: 'Building answer', status: 'complete' as const, durationMs: 300 },
  ],
  totalDurationMs: 420,
  confidence: { overall: 0.88, retrievalCoverage: 0.9, sourceAgreement: 0.85, modelCertainty: 0.92 },
  chunksRetrieved: 12,
  documentsUsed: 3,
  model: 'gpt-4o',
}

describe('ReasoningPanel', () => {
  it('renders "Reasoning Trace" text', () => {
    render(<ReasoningPanel trace={mockTrace} />)
    expect(screen.getByText('Reasoning Trace')).toBeTruthy()
  })

  it('renders step count and duration', () => {
    render(<ReasoningPanel trace={mockTrace} />)
    expect(screen.getByText(/2 steps, 420ms/)).toBeTruthy()
  })

  it('renders confidence badge', () => {
    render(<ReasoningPanel trace={mockTrace} />)
    expect(screen.getByTestId('confidence')).toBeTruthy()
  })

  it('expands on click to show steps', () => {
    render(<ReasoningPanel trace={mockTrace} />)
    fireEvent.click(screen.getByText('Reasoning Trace'))
    expect(screen.getByTestId('step-s1')).toBeTruthy()
    expect(screen.getByTestId('step-s2')).toBeTruthy()
  })

  it('shows metadata when expanded', () => {
    render(<ReasoningPanel trace={mockTrace} defaultExpanded={true} />)
    expect(screen.getByText('12 chunks retrieved')).toBeTruthy()
    expect(screen.getByText('3 documents used')).toBeTruthy()
    expect(screen.getByText('gpt-4o')).toBeTruthy()
  })
})
