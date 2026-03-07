/**
 * Sarah — S-P0-02: ThreadSidebar tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

const mockChatStore: Record<string, unknown> = {
  threads: [],
  threadsLoading: false,
  threadId: null,
  fetchThreads: jest.fn(),
  loadThread: jest.fn(),
  clearThread: jest.fn(),
  setSidebarOpen: jest.fn(),
}

jest.mock('@/stores/chatStore', () => ({
  useChatStore: (sel: (s: Record<string, unknown>) => unknown) => sel(mockChatStore),
}))

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    MessageSquarePlus: icon('message-square-plus'),
    X: icon('x'),
    Loader2: icon('loader'),
  }
})

import { ThreadSidebar } from '../ThreadSidebar'

describe('ThreadSidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockChatStore.threads = []
    mockChatStore.threadsLoading = false
    mockChatStore.threadId = null
  })

  it('renders New Chat button', () => {
    render(<ThreadSidebar />)
    expect(screen.getByText('New Chat')).toBeTruthy()
  })

  it('renders close sidebar button', () => {
    render(<ThreadSidebar />)
    expect(screen.getByLabelText('Close sidebar')).toBeTruthy()
  })

  it('calls setSidebarOpen(false) on close click', () => {
    render(<ThreadSidebar />)
    fireEvent.click(screen.getByLabelText('Close sidebar'))
    expect(mockChatStore.setSidebarOpen).toHaveBeenCalledWith(false)
  })

  it('calls clearThread and fetchThreads on New Chat click', () => {
    render(<ThreadSidebar />)
    fireEvent.click(screen.getByText('New Chat'))
    expect(mockChatStore.clearThread).toHaveBeenCalled()
    expect(mockChatStore.fetchThreads).toHaveBeenCalled()
  })

  it('shows empty state when no threads', () => {
    render(<ThreadSidebar />)
    expect(screen.getByText('No conversations yet')).toBeTruthy()
  })

  it('shows loading spinner when loading with no threads', () => {
    mockChatStore.threadsLoading = true
    render(<ThreadSidebar />)
    expect(screen.getByTestId('icon-loader')).toBeTruthy()
  })

  it('renders thread titles', () => {
    mockChatStore.threads = [
      { id: 't1', title: 'Contract Q&A', updatedAt: new Date().toISOString(), messageCount: 5 },
    ]
    render(<ThreadSidebar />)
    expect(screen.getByText('Contract Q&A')).toBeTruthy()
  })

  it('calls loadThread on thread click', () => {
    mockChatStore.threads = [
      { id: 't1', title: 'Discussion', updatedAt: new Date().toISOString(), messageCount: 2 },
    ]
    render(<ThreadSidebar />)
    fireEvent.click(screen.getByText('Discussion'))
    expect(mockChatStore.loadThread).toHaveBeenCalledWith('t1')
  })

  it('calls fetchThreads on mount', () => {
    render(<ThreadSidebar />)
    expect(mockChatStore.fetchThreads).toHaveBeenCalled()
  })
})
