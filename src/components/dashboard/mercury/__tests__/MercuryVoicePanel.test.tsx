import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

// ── Mock hooks ──────────────────────────────────────────────────
const mockConnect = jest.fn().mockResolvedValue(undefined)
const mockDisconnect = jest.fn()
const mockEnableVAD = jest.fn()
const mockDisableVAD = jest.fn()

let mockVoiceState = {
  state: 'disconnected' as string,
  isConnected: false,
  isSpeaking: false,
  isVADActive: false,
  audioLevel: 0,
  transcript: [] as Array<{ id: string; type: string; text: string; isFinal: boolean }>,
  connect: mockConnect,
  disconnect: mockDisconnect,
  enableVAD: mockEnableVAD,
  disableVAD: mockDisableVAD,
}

jest.mock('@/hooks/useSovereignAgentVoice', () => ({
  useSovereignAgentVoice: () => mockVoiceState,
}))

jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: { user: { id: 'test-user', email: 'test@ragbox.co' } },
    status: 'authenticated',
  }),
}))

jest.mock('@/stores/privilegeStore', () => ({
  usePrivilegeStore: (selector: (s: { isEnabled: boolean }) => unknown) =>
    selector({ isEnabled: false }),
}))

// Mock framer-motion to render divs instead of animated elements
jest.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLDivElement>) => (
      <div ref={ref} {...filterDOMProps(props)}>{children}</div>
    )),
    button: React.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLButtonElement>) => (
      <button ref={ref} {...filterDOMProps(props)}>{children}</button>
    )),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}))

// Filter out framer-motion props that aren't valid DOM attributes
function filterDOMProps(props: Record<string, unknown>) {
  const filtered: Record<string, unknown> = {}
  for (const [key, val] of Object.entries(props)) {
    if (!['whileHover', 'whileTap', 'initial', 'animate', 'exit', 'transition', 'variants'].includes(key)) {
      filtered[key] = val
    }
  }
  return filtered
}

import { MercuryVoicePanel } from '../MercuryVoicePanel'

describe('MercuryVoicePanel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockVoiceState = {
      state: 'disconnected',
      isConnected: false,
      isSpeaking: false,
      isVADActive: false,
      audioLevel: 0,
      transcript: [],
      connect: mockConnect,
      disconnect: mockDisconnect,
      enableVAD: mockEnableVAD,
      disableVAD: mockDisableVAD,
    }
  })

  it('renders initial disconnected state with Mercury header', () => {
    render(<MercuryVoicePanel />)
    expect(screen.getByText('Mercury')).toBeInTheDocument()
    expect(screen.getByText('Voice agent offline')).toBeInTheDocument()
    expect(screen.getByText(/Press power to activate/)).toBeInTheDocument()
  })

  it('shows connecting state when state is connecting', () => {
    mockVoiceState.state = 'connecting'
    render(<MercuryVoicePanel />)
    expect(screen.getByText('Connecting...')).toBeInTheDocument()
  })

  it('shows listening indicator when connected and VAD active', () => {
    mockVoiceState.state = 'listening'
    mockVoiceState.isConnected = true
    mockVoiceState.isVADActive = true
    render(<MercuryVoicePanel />)
    expect(screen.getByText('Listening')).toBeInTheDocument()
    expect(screen.getByText('VAD Active')).toBeInTheDocument()
    expect(screen.getByText('Hands-free voice mode')).toBeInTheDocument()
  })

  it('shows speaking state when agent is speaking', () => {
    mockVoiceState.state = 'idle'
    mockVoiceState.isConnected = true
    mockVoiceState.isSpeaking = true
    render(<MercuryVoicePanel />)
    expect(screen.getByText('Speaking')).toBeInTheDocument()
  })

  it('shows error state', () => {
    mockVoiceState.state = 'error'
    render(<MercuryVoicePanel />)
    expect(screen.getByText('Error')).toBeInTheDocument()
  })

  it('shows offline when disconnected', () => {
    mockVoiceState.state = 'idle'
    mockVoiceState.isConnected = false
    render(<MercuryVoicePanel />)
    expect(screen.getByText('Offline')).toBeInTheDocument()
  })

  it('calls enableVAD on power button click when disconnected (BUG-039)', () => {
    render(<MercuryVoicePanel />)
    // There should be a power button (the main circular button)
    const buttons = screen.getAllByRole('button')
    // First button is the power toggle
    fireEvent.click(buttons[0])
    // BUG-039: Power toggle now calls enableVAD() which internally calls connect()
    expect(mockEnableVAD).toHaveBeenCalled()
  })

  it('calls disconnect on power button click when connected', () => {
    mockVoiceState.state = 'idle'
    mockVoiceState.isConnected = true
    render(<MercuryVoicePanel />)
    const buttons = screen.getAllByRole('button')
    // First button is the power toggle
    fireEvent.click(buttons[0])
    expect(mockDisableVAD).toHaveBeenCalled()
    expect(mockDisconnect).toHaveBeenCalled()
  })
})
