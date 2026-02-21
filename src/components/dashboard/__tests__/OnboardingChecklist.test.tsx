import React from 'react'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'

// ── Mock stores ─────────────────────────────────────────────────
let mockDocuments: Record<string, unknown> = {}
let mockMessages: Array<{ role: string; citations?: Array<unknown> }> = []

jest.mock('@/stores/vaultStore', () => ({
  useVaultStore: (selector: (s: { documents: Record<string, unknown> }) => unknown) =>
    selector({ documents: mockDocuments }),
}))

jest.mock('@/stores/mercuryStore', () => ({
  useMercuryStore: (selector: (s: { messages: Array<{ role: string; citations?: Array<unknown> }> }) => unknown) =>
    selector({ messages: mockMessages }),
}))

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLDivElement>) => {
      const filtered: Record<string, unknown> = {}
      for (const [key, val] of Object.entries(props)) {
        if (!['initial', 'animate', 'exit', 'transition', 'variants', 'whileHover', 'whileTap'].includes(key)) {
          filtered[key] = val
        }
      }
      return <div ref={ref} {...filtered}>{children}</div>
    }),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}))

// Mock localStorage with proper reset support
let localStore: Record<string, string> = {}

const localStorageMock = {
  getItem: jest.fn((key: string) => localStore[key] ?? null),
  setItem: jest.fn((key: string, value: string) => { localStore[key] = value }),
  removeItem: jest.fn((key: string) => { delete localStore[key] }),
  clear: jest.fn(() => { localStore = {} }),
}

Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true })

import { OnboardingChecklist } from '../OnboardingChecklist'

describe('OnboardingChecklist', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    localStore = {}
    mockDocuments = {}
    mockMessages = []
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it('renders all 4 steps when not dismissed', async () => {
    render(<OnboardingChecklist />)
    // Advance the 800ms visibility timer
    act(() => { jest.advanceTimersByTime(900) })

    expect(screen.getByText('Getting Started')).toBeInTheDocument()
    expect(screen.getByText('Upload your first document')).toBeInTheDocument()
    expect(screen.getByText('Ask Mercury a question')).toBeInTheDocument()
    expect(screen.getByText('Review cited sources')).toBeInTheDocument()
    expect(screen.getByText('Explore Privilege Mode')).toBeInTheDocument()
  })

  it('shows progress counter as 0/4 initially', () => {
    render(<OnboardingChecklist />)
    act(() => { jest.advanceTimersByTime(900) })

    expect(screen.getByText('0/4 complete')).toBeInTheDocument()
  })

  it('marks step 1 complete when documents exist', () => {
    mockDocuments = { 'doc-1': { name: 'test.pdf' } }
    render(<OnboardingChecklist />)
    act(() => { jest.advanceTimersByTime(900) })

    expect(screen.getByText('1/4 complete')).toBeInTheDocument()
  })

  it('marks step 2 complete when user has sent a message', () => {
    mockMessages = [{ role: 'user' }]
    render(<OnboardingChecklist />)
    act(() => { jest.advanceTimersByTime(900) })

    expect(screen.getByText('1/4 complete')).toBeInTheDocument()
  })

  it('marks step 3 complete when a message has citations', () => {
    mockDocuments = { 'doc-1': {} }
    mockMessages = [
      { role: 'user' },
      { role: 'assistant', citations: [{ snippet: 'test' }] },
    ]
    render(<OnboardingChecklist />)
    act(() => { jest.advanceTimersByTime(900) })

    expect(screen.getByText('3/4 complete')).toBeInTheDocument()
  })

  it('does not render when previously dismissed via localStorage', () => {
    localStore['ragbox-onboarding-dismissed'] = 'true'
    const { container } = render(<OnboardingChecklist />)
    act(() => { jest.advanceTimersByTime(900) })

    // Should render nothing
    expect(screen.queryByText('Getting Started')).not.toBeInTheDocument()
  })

  it('dismisses on X button click and persists to localStorage', async () => {
    render(<OnboardingChecklist />)
    // Wait for visibility timer
    act(() => { jest.advanceTimersByTime(900) })

    // Find dismiss button by aria-label
    const dismissButton = screen.getByRole('button', { name: /dismiss/i })
    fireEvent.click(dismissButton)

    // Advance the 300ms dismiss animation delay
    act(() => { jest.advanceTimersByTime(400) })

    expect(localStorageMock.setItem).toHaveBeenCalledWith('ragbox-onboarding-dismissed', 'true')
  })

  it('updates progress when documents and messages exist', () => {
    mockDocuments = { 'doc-1': {} }
    mockMessages = [{ role: 'user' }]
    render(<OnboardingChecklist />)
    act(() => { jest.advanceTimersByTime(900) })

    // 2 steps complete: upload + query
    expect(screen.getByText('2/4 complete')).toBeInTheDocument()
  })
})
