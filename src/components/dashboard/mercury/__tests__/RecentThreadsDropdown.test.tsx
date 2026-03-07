/**
 * Sarah — S-P0-02: RecentThreadsDropdown tests
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockMercuryStore: Record<string, unknown> = {
  threadId: null,
  switchThread: jest.fn().mockResolvedValue(undefined),
}

jest.mock('@/stores/mercuryStore', () => ({
  useMercuryStore: (sel: (s: Record<string, unknown>) => unknown) => sel(mockMercuryStore),
}))

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return { Clock: icon('clock') }
})

import { RecentThreadsDropdown } from '../RecentThreadsDropdown'

describe('RecentThreadsDropdown', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockMercuryStore.threadId = null
    global.fetch = jest.fn()
  })

  it('renders trigger button', () => {
    render(<RecentThreadsDropdown />)
    expect(screen.getByLabelText('Recent chats')).toBeTruthy()
  })

  it('button has aria-expanded false initially', () => {
    render(<RecentThreadsDropdown />)
    expect(screen.getByLabelText('Recent chats').getAttribute('aria-expanded')).toBe('false')
  })

  it('opens dropdown on click and shows "Recent Chats" header', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ data: { threads: [] } }),
    })
    render(<RecentThreadsDropdown />)
    fireEvent.click(screen.getByLabelText('Recent chats'))
    expect(screen.getByText('Recent Chats')).toBeTruthy()
  })

  it('shows "No recent chats" when empty', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({ data: { threads: [] } }),
    })
    render(<RecentThreadsDropdown />)
    fireEvent.click(screen.getByLabelText('Recent chats'))
    await waitFor(() => {
      expect(screen.getByText('No recent chats')).toBeTruthy()
    })
  })

  it('renders thread titles', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({
        data: {
          threads: [
            { id: 't1', title: 'Contract Review', updatedAt: '2026-03-07T12:00:00Z', createdAt: '2026-03-07T10:00:00Z' },
          ],
        },
      }),
    })
    render(<RecentThreadsDropdown />)
    fireEvent.click(screen.getByLabelText('Recent chats'))
    await waitFor(() => {
      expect(screen.getByText('Contract Review')).toBeTruthy()
    })
  })

  it('shows "Untitled Chat" for threads without title', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({
        data: {
          threads: [
            { id: 't1', title: null, updatedAt: '2026-03-07T12:00:00Z', createdAt: '2026-03-07T10:00:00Z' },
          ],
        },
      }),
    })
    render(<RecentThreadsDropdown />)
    fireEvent.click(screen.getByLabelText('Recent chats'))
    await waitFor(() => {
      expect(screen.getByText('Untitled Chat')).toBeTruthy()
    })
  })

  it('calls switchThread on thread click', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({
      json: async () => ({
        data: {
          threads: [
            { id: 't1', title: 'Chat 1', updatedAt: '2026-03-07T12:00:00Z', createdAt: '2026-03-07T10:00:00Z' },
          ],
        },
      }),
    })
    render(<RecentThreadsDropdown />)
    fireEvent.click(screen.getByLabelText('Recent chats'))
    await waitFor(() => screen.getByText('Chat 1'))
    fireEvent.click(screen.getByText('Chat 1'))
    expect(mockMercuryStore.switchThread).toHaveBeenCalledWith('t1')
  })
})
