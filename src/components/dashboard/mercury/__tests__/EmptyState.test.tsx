/**
 * Sarah — S-P0-02: EmptyState tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

const mockSetInputValue = jest.fn()

jest.mock('@/stores/mercuryStore', () => ({
  useMercuryStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ setInputValue: mockSetInputValue }),
}))

jest.mock('lucide-react', () => ({
  MessageSquare: (props: React.ComponentProps<'svg'>) => <svg data-testid="icon-msg" {...props} />,
  Sparkles: (props: React.ComponentProps<'svg'>) => <svg data-testid="icon-sparkle" {...props} />,
}))

import { EmptyState } from '../EmptyState'

describe('EmptyState', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders the heading', () => {
    render(<EmptyState />)
    expect(screen.getByText('Start a conversation')).toBeTruthy()
  })

  it('renders 4 suggested prompts', () => {
    render(<EmptyState />)
    expect(screen.getByText('What should I know about these documents?')).toBeTruthy()
    expect(screen.getByText('Are there any risks or red flags I should worry about?')).toBeTruthy()
    expect(screen.getByText('Give me an executive brief I can forward to my team')).toBeTruthy()
    expect(screen.getByText('Walk me through the key dates and deadlines')).toBeTruthy()
  })

  it('calls setInputValue with prompt text on click', () => {
    render(<EmptyState />)
    fireEvent.click(screen.getByText('What should I know about these documents?'))
    expect(mockSetInputValue).toHaveBeenCalledWith('What should I know about these documents?')
  })

  it('renders description text', () => {
    render(<EmptyState />)
    expect(screen.getByText(/Drop a question about your documents/)).toBeTruthy()
  })
})
