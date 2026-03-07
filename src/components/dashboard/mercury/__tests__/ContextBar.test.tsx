/**
 * Sarah — S-P0-02: ContextBar tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

const mockMercuryStore: Record<string, unknown> = {
  startNewThread: jest.fn().mockResolvedValue(undefined),
  sessionQueryCount: 0,
  sessionTopics: [],
}

jest.mock('@/stores/mercuryStore', () => ({
  useMercuryStore: (sel: (s: Record<string, unknown>) => unknown) => sel(mockMercuryStore),
}))

jest.mock('sonner', () => ({
  toast: { success: jest.fn() },
}))

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return { Plus: icon('plus'), Clock: icon('clock') }
})

jest.mock('../RecentThreadsDropdown', () => ({
  RecentThreadsDropdown: () => <div data-testid="recent-threads" />,
}))

import { ContextBar } from '../ContextBar'

describe('ContextBar', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockMercuryStore.sessionQueryCount = 0
    mockMercuryStore.sessionTopics = []
  })

  it('renders "All documents" label', () => {
    render(<ContextBar />)
    expect(screen.getByText('All documents')).toBeTruthy()
  })

  it('renders new chat button', () => {
    render(<ContextBar />)
    expect(screen.getByLabelText('Start new chat')).toBeTruthy()
  })

  it('calls startNewThread on new chat click', async () => {
    render(<ContextBar />)
    fireEvent.click(screen.getByLabelText('Start new chat'))
    expect(mockMercuryStore.startNewThread).toHaveBeenCalled()
  })

  it('renders RecentThreadsDropdown', () => {
    render(<ContextBar />)
    expect(screen.getByTestId('recent-threads')).toBeTruthy()
  })

  it('shows session query count when > 0', () => {
    mockMercuryStore.sessionQueryCount = 5
    render(<ContextBar />)
    expect(screen.getByText('Session: 5 queries')).toBeTruthy()
  })

  it('uses singular "query" for 1', () => {
    mockMercuryStore.sessionQueryCount = 1
    render(<ContextBar />)
    expect(screen.getByText('Session: 1 query')).toBeTruthy()
  })

  it('does not show session info when 0 queries', () => {
    render(<ContextBar />)
    expect(screen.queryByText(/Session:/)).toBeNull()
  })

  it('shows session topics as tags', () => {
    mockMercuryStore.sessionQueryCount = 3
    mockMercuryStore.sessionTopics = ['contracts', 'compliance']
    render(<ContextBar />)
    expect(screen.getByText('contracts')).toBeTruthy()
    expect(screen.getByText('compliance')).toBeTruthy()
  })
})
