/**
 * Sarah — S-P0-02: ReasoningStep tests
 */

import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return { Check: icon('check'), Loader2: icon('loader'), AlertCircle: icon('alert'), Clock: icon('clock') }
})

import ReasoningStepItem from '../ReasoningStep'

describe('ReasoningStepItem', () => {
  it('renders step label and description', () => {
    render(<ReasoningStepItem step={{ id: '1', label: 'Retrieval', description: 'Searching vault', status: 'complete' }} />)
    expect(screen.getByText('Retrieval')).toBeTruthy()
    expect(screen.getByText('Searching vault')).toBeTruthy()
  })

  it('shows check icon for complete status', () => {
    render(<ReasoningStepItem step={{ id: '1', label: 'Done', description: '', status: 'complete' }} />)
    expect(screen.getByTestId('icon-check')).toBeTruthy()
  })

  it('shows loader icon for running status', () => {
    render(<ReasoningStepItem step={{ id: '1', label: 'Running', description: '', status: 'running' }} />)
    expect(screen.getByTestId('icon-loader')).toBeTruthy()
  })

  it('shows clock icon for pending status', () => {
    render(<ReasoningStepItem step={{ id: '1', label: 'Pending', description: '', status: 'pending' }} />)
    expect(screen.getByTestId('icon-clock')).toBeTruthy()
  })

  it('shows alert icon for error status', () => {
    render(<ReasoningStepItem step={{ id: '1', label: 'Error', description: '', status: 'error' }} />)
    expect(screen.getByTestId('icon-alert')).toBeTruthy()
  })

  it('shows duration when provided', () => {
    render(<ReasoningStepItem step={{ id: '1', label: 'Step', description: '', status: 'complete', durationMs: 150 }} />)
    expect(screen.getByText('150ms')).toBeTruthy()
  })

  it('does not show duration when not provided', () => {
    render(<ReasoningStepItem step={{ id: '1', label: 'Step', description: '', status: 'complete' }} />)
    expect(screen.queryByText(/ms/)).toBeNull()
  })
})
