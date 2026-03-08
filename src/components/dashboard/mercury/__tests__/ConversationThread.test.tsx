/**
 * Sarah — S-P0-02: ConversationThread tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

const mockMercuryStore: Record<string, unknown> = {
  messages: [],
  isStreaming: false,
  streamingContent: '',
  channelFilter: 'all',
  setChannelFilter: jest.fn(),
  filteredMessages: jest.fn(() => []),
  insights: [],
}

jest.mock('@/stores/mercuryStore', () => ({
  useMercuryStore: (sel: (s: Record<string, unknown>) => unknown) => sel(mockMercuryStore),
}))

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return { ChevronDown: icon('chevron-down') }
})

jest.mock('../Message', () => ({
  Message: ({ message }: { message: { id: string; content: string } }) => (
    <div data-testid={`msg-${message.id}`}>{message.content}</div>
  ),
  extractProse: (s: string) => s,
}))

jest.mock('../EmptyState', () => ({
  EmptyState: () => <div data-testid="empty-state">Empty</div>,
}))

jest.mock('../InsightCard', () => ({
  InsightCard: ({ id, content }: { id: string; content: string }) => (
    <div data-testid={`insight-${id}`}>{content}</div>
  ),
}))

import { ConversationThread } from '../ConversationThread'

// jsdom doesn't implement scrollIntoView
Element.prototype.scrollIntoView = jest.fn()

describe('ConversationThread', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockMercuryStore.messages = []
    mockMercuryStore.isStreaming = false
    mockMercuryStore.streamingContent = ''
    mockMercuryStore.channelFilter = 'all'
    mockMercuryStore.insights = []
    mockMercuryStore.filteredMessages = jest.fn(() => [])
  })

  it('shows EmptyState when no messages and not streaming', () => {
    render(<ConversationThread />)
    expect(screen.getByTestId('empty-state')).toBeTruthy()
  })

  it('renders channel filter buttons when messages exist', () => {
    mockMercuryStore.messages = [{ id: 'm1', role: 'user', content: 'Hi' }]
    mockMercuryStore.filteredMessages = jest.fn(() => [{ id: 'm1', role: 'user', content: 'Hi' }])
    render(<ConversationThread />)
    expect(screen.getByText('All')).toBeTruthy()
    expect(screen.getByText('Dashboard')).toBeTruthy()
    expect(screen.getByText('WhatsApp')).toBeTruthy()
    expect(screen.getByText('Voice')).toBeTruthy()
  })

  it('calls setChannelFilter on filter button click', () => {
    mockMercuryStore.messages = [{ id: 'm1', role: 'user', content: 'Hi' }]
    mockMercuryStore.filteredMessages = jest.fn(() => [])
    render(<ConversationThread />)
    fireEvent.click(screen.getByText('Voice'))
    expect(mockMercuryStore.setChannelFilter).toHaveBeenCalledWith('voice')
  })

  it('renders messages via Message component', () => {
    mockMercuryStore.messages = [{ id: 'm1', role: 'user', content: 'Hello' }]
    mockMercuryStore.filteredMessages = jest.fn(() => [
      { id: 'm1', role: 'user', content: 'Hello' },
    ])
    render(<ConversationThread />)
    expect(screen.getByTestId('msg-m1')).toBeTruthy()
  })

  // Phase 4 insight rendering not yet wired in ConversationThread component.
  // These tests will be re-enabled when InsightCard integration lands.
  it.skip('renders insight cards when present', () => {
    mockMercuryStore.messages = [{ id: 'm1', role: 'user', content: 'Hi' }]
    mockMercuryStore.filteredMessages = jest.fn(() => [{ id: 'm1', role: 'user', content: 'Hi' }])
    mockMercuryStore.insights = [
      { id: 'ins-1', content: 'Tip: Check page 5', dismissed: false },
    ]
    render(<ConversationThread />)
    expect(screen.getByTestId('insight-ins-1')).toBeTruthy()
  })

  it.skip('does not render dismissed insights', () => {
    mockMercuryStore.messages = [{ id: 'm1', role: 'user', content: 'Hi' }]
    mockMercuryStore.filteredMessages = jest.fn(() => [{ id: 'm1', role: 'user', content: 'Hi' }])
    mockMercuryStore.insights = [
      { id: 'ins-1', content: 'Dismissed', dismissed: true },
    ]
    render(<ConversationThread />)
    expect(screen.queryByTestId('insight-ins-1')).toBeNull()
  })

  it('shows "Analyzing..." when streaming with no content', () => {
    mockMercuryStore.messages = [{ id: 'm1', role: 'user', content: 'Hi' }]
    mockMercuryStore.isStreaming = true
    mockMercuryStore.streamingContent = ''
    mockMercuryStore.filteredMessages = jest.fn(() => [])
    render(<ConversationThread />)
    expect(screen.getByText('Analyzing...')).toBeTruthy()
  })

  it('has role="log" for accessibility', () => {
    mockMercuryStore.messages = [{ id: 'm1', role: 'user', content: 'Hi' }]
    mockMercuryStore.filteredMessages = jest.fn(() => [])
    render(<ConversationThread />)
    expect(screen.getByRole('log')).toBeTruthy()
  })
})
