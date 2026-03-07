/**
 * Sarah — S-P0-02: CenterHeader tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

const mockStore: Record<string, unknown> = {
  messages: [],
  threadTitle: '',
  documentScope: null,
  documentScopeName: null,
  setDocumentScope: jest.fn(),
  clearThread: jest.fn(),
  incognitoMode: false,
  sidebarOpen: false,
  setSidebarOpen: jest.fn(),
  responseLayout: 'conversation',
  setResponseLayout: jest.fn(),
}

jest.mock('@/stores/chatStore', () => ({
  useChatStore: (sel: (s: Record<string, unknown>) => unknown) => sel(mockStore),
}))

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    MessageSquare: icon('message-square'),
    FileText: icon('file-text'),
    X: icon('x'),
    MessageSquarePlus: icon('message-square-plus'),
    EyeOff: icon('eye-off'),
    PanelLeft: icon('panel-left'),
    ClipboardList: icon('clipboard-list'),
    Columns2: icon('columns2'),
  }
})

import { CenterHeader } from '../CenterHeader'

describe('CenterHeader', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockStore.messages = []
    mockStore.threadTitle = ''
    mockStore.documentScope = null
    mockStore.documentScopeName = null
    mockStore.incognitoMode = false
    mockStore.sidebarOpen = false
    mockStore.responseLayout = 'conversation'
  })

  it('renders "New Chat" when no thread title', () => {
    render(<CenterHeader />)
    expect(screen.getByText('New Chat')).toBeTruthy()
  })

  it('renders thread title when set', () => {
    mockStore.threadTitle = 'Contract Analysis'
    render(<CenterHeader />)
    expect(screen.getByText('Contract Analysis')).toBeTruthy()
  })

  it('renders 3 layout mode buttons', () => {
    render(<CenterHeader />)
    expect(screen.getByLabelText('Dossier layout')).toBeTruthy()
    expect(screen.getByLabelText('Conversation layout')).toBeTruthy()
    expect(screen.getByLabelText('Analyst layout')).toBeTruthy()
  })

  it('calls setResponseLayout on layout button click', () => {
    render(<CenterHeader />)
    fireEvent.click(screen.getByLabelText('Dossier layout'))
    expect(mockStore.setResponseLayout).toHaveBeenCalledWith('dossier')
  })

  it('shows incognito badge when incognito mode is on', () => {
    mockStore.incognitoMode = true
    render(<CenterHeader />)
    expect(screen.getByText('Incognito')).toBeTruthy()
  })

  it('does not show incognito badge when off', () => {
    render(<CenterHeader />)
    expect(screen.queryByText('Incognito')).toBeNull()
  })

  it('shows query count when messages exist', () => {
    mockStore.messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' },
      { role: 'user', content: 'Q2' },
    ]
    render(<CenterHeader />)
    expect(screen.getByText('2 queries')).toBeTruthy()
  })

  it('shows singular "query" for 1 user message', () => {
    mockStore.messages = [{ role: 'user', content: 'Hello' }]
    render(<CenterHeader />)
    expect(screen.getByText('1 query')).toBeTruthy()
  })

  it('calls clearThread on new chat button click', () => {
    render(<CenterHeader />)
    fireEvent.click(screen.getByLabelText('New chat'))
    expect(mockStore.clearThread).toHaveBeenCalled()
  })

  it('toggles sidebar on sidebar button click', () => {
    render(<CenterHeader />)
    fireEvent.click(screen.getByLabelText('Toggle thread history'))
    expect(mockStore.setSidebarOpen).toHaveBeenCalledWith(true)
  })

  it('shows document scope chip when set', () => {
    mockStore.documentScope = 'doc-123'
    mockStore.documentScopeName = 'contract.pdf'
    render(<CenterHeader />)
    expect(screen.getByText(/Chatting about: contract\.pdf/)).toBeTruthy()
  })

  it('clears document scope on X click', () => {
    mockStore.documentScope = 'doc-123'
    mockStore.documentScopeName = 'contract.pdf'
    render(<CenterHeader />)
    fireEvent.click(screen.getByLabelText('Clear document scope'))
    expect(mockStore.setDocumentScope).toHaveBeenCalledWith(null)
  })
})
