/**
 * @jest-environment jsdom
 */

/**
 * Tests for InputBar VAD (Voice Activity Detection) integration — STORY-083
 *
 * Verifies that the InputBar correctly wires the useDeepgramSTT hook
 * for mic toggle, transcript sync, and audio level visualization.
 */

import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'

// ── Mock useDeepgramSTT ──────────────────────────────────────────
const mockStartListening = jest.fn().mockResolvedValue(undefined)
const mockStopListening = jest.fn()

let sttState = {
  isListening: false,
  transcript: '',
  audioLevel: 0,
  error: null as string | null,
}

jest.mock('@/hooks/useDeepgramSTT', () => ({
  useDeepgramSTT: () => ({
    ...sttState,
    startListening: mockStartListening,
    stopListening: mockStopListening,
  }),
}))

// ── Mock mercuryStore ────────────────────────────────────────────
const mockSetInputValue = jest.fn()
const mockSendMessage = jest.fn()
const mockStopStreaming = jest.fn()
const mockAddAttachment = jest.fn()
const mockRemoveAttachment = jest.fn()
const mockUpdateAttachment = jest.fn()
const mockSetMercuryIntelligence = jest.fn()

jest.mock('@/stores/mercuryStore', () => ({
  useMercuryStore: (selector: (s: Record<string, unknown>) => unknown) => {
    const state: Record<string, unknown> = {
      inputValue: '',
      setInputValue: mockSetInputValue,
      sendMessage: mockSendMessage,
      stopStreaming: mockStopStreaming,
      isStreaming: false,
      attachments: [],
      addAttachment: mockAddAttachment,
      removeAttachment: mockRemoveAttachment,
      updateAttachment: mockUpdateAttachment,
      activePersona: 'mercury',
      mercuryIntelligence: { id: 'aegis-core', displayName: 'Aegis', provider: 'RAGbox', tier: 'native' },
      setMercuryIntelligence: mockSetMercuryIntelligence,
    }
    return selector(state)
  },
}))

// ── Mock privilegeStore ──────────────────────────────────────────
jest.mock('@/stores/privilegeStore', () => ({
  usePrivilegeStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ isEnabled: false }),
}))

// ── Mock LlmPicker (not under test) ─────────────────────────────
jest.mock('../ChatModelPicker', () => ({
  LlmPicker: () => <div data-testid="llm-picker" />,
}))

// ── Mock personaData ─────────────────────────────────────────────
jest.mock('../personaData', () => ({
  PERSONAS: [{ id: 'mercury', name: 'Mercury', category: 'general' }],
}))

// ── Mock sonner ──────────────────────────────────────────────────
jest.mock('sonner', () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}))

// ── Mock api fetch ───────────────────────────────────────────────
jest.mock('@/lib/api', () => ({
  apiFetch: jest.fn(),
}))

import { InputBar } from '../InputBar'

// ── Setup ────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
  sttState = {
    isListening: false,
    transcript: '',
    audioLevel: 0,
    error: null,
  }
})

// ── Tests ────────────────────────────────────────────────────────

describe('InputBar VAD integration', () => {
  it('mic button renders in InputBar', () => {
    render(<InputBar />)

    const micBtn = screen.getByRole('button', { name: 'Start voice input' })
    expect(micBtn).toBeInTheDocument()
  })

  it('click mic calls startListening', () => {
    render(<InputBar />)

    const micBtn = screen.getByRole('button', { name: 'Start voice input' })
    fireEvent.click(micBtn)

    expect(mockStartListening).toHaveBeenCalledTimes(1)
  })

  it('click mic again calls stopListening', () => {
    sttState.isListening = true

    render(<InputBar />)

    const micBtn = screen.getByRole('button', { name: 'Stop voice input' })
    fireEvent.click(micBtn)

    expect(mockStopListening).toHaveBeenCalledTimes(1)
  })

  it('transcript syncs to input field value while listening', () => {
    sttState.isListening = true
    sttState.transcript = 'hello world'

    render(<InputBar />)

    // The useEffect sets inputValue via setInputValue when listening + transcript changes
    expect(mockSetInputValue).toHaveBeenCalledWith('hello world')
  })

  it('audioLevel drives voice level indicator bars', () => {
    sttState.isListening = true
    sttState.audioLevel = 0.5

    render(<InputBar />)

    // Voice level indicator is visible when listening
    const indicator = screen.getByLabelText('Audio level 50%')
    expect(indicator).toBeInTheDocument()

    // 5 bars at thresholds [0.2, 0.4, 0.6, 0.8, 1.0]
    // At audioLevel=0.5, bars at 0.2 and 0.4 should be active (bg-[var(--danger)])
    const bars = indicator.querySelectorAll('div')
    expect(bars).toHaveLength(5)
  })
})
