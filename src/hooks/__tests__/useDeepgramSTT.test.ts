/**
 * @jest-environment jsdom
 */

/**
 * Tests for useDeepgramSTT hook — STORY-083
 *
 * Mocks DeepgramClient and AudioCapture to test the hook's
 * state management without hitting real Deepgram or microphone.
 */

import { renderHook, act } from '@testing-library/react'

// ── Mock DeepgramClient ─────────────────────────────────────────
const mockConnect = jest.fn()
const mockDisconnect = jest.fn()
const mockSendAudio = jest.fn()

let capturedCallbacks: {
  onTranscriptInterim?: (text: string) => void
  onTranscriptFinal?: (text: string) => void
  onError?: (err: Error) => void
} = {}

jest.mock('@/lib/voice/deepgram-client', () => ({
  DeepgramClient: jest.fn().mockImplementation((callbacks: typeof capturedCallbacks) => {
    capturedCallbacks = callbacks
    return {
      connect: mockConnect,
      disconnect: mockDisconnect,
      sendAudio: mockSendAudio,
    }
  }),
}))

// ── Mock AudioCapture ───────────────────────────────────────────
const mockRequestPermission = jest.fn()
const mockStart = jest.fn()
const mockStop = jest.fn()

jest.mock('@/lib/voice/audio-capture', () => ({
  AudioCapture: jest.fn().mockImplementation(() => ({
    requestPermission: mockRequestPermission,
    start: mockStart,
    stop: mockStop,
  })),
}))

import { useDeepgramSTT } from '../useDeepgramSTT'

// ── Setup ────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks()
  capturedCallbacks = {}
  mockRequestPermission.mockResolvedValue('granted')
  mockConnect.mockResolvedValue(undefined)
  mockStart.mockResolvedValue(undefined)
})

// ── Tests ────────────────────────────────────────────────────────

describe('useDeepgramSTT', () => {
  it('startListening sets isListening=true', async () => {
    const { result } = renderHook(() => useDeepgramSTT())

    expect(result.current.isListening).toBe(false)

    await act(async () => {
      await result.current.startListening()
    })

    expect(result.current.isListening).toBe(true)
  })

  it('stopListening sets isListening=false and audioLevel=0', async () => {
    const { result } = renderHook(() => useDeepgramSTT())

    await act(async () => {
      await result.current.startListening()
    })
    expect(result.current.isListening).toBe(true)

    act(() => {
      result.current.stopListening()
    })

    expect(result.current.isListening).toBe(false)
    expect(result.current.audioLevel).toBe(0)
  })

  it('transcript updates on interim callback', async () => {
    const { result } = renderHook(() => useDeepgramSTT())

    await act(async () => {
      await result.current.startListening()
    })

    // Simulate interim transcript from Deepgram
    act(() => {
      capturedCallbacks.onTranscriptInterim?.('hello wor')
    })

    expect(result.current.transcript).toBe('hello wor')
  })

  it('transcript appends on final callback', async () => {
    const { result } = renderHook(() => useDeepgramSTT())

    await act(async () => {
      await result.current.startListening()
    })

    // First final transcript
    act(() => {
      capturedCallbacks.onTranscriptFinal?.('Hello world.')
    })
    expect(result.current.transcript).toBe('Hello world.')

    // Second final transcript — should append
    act(() => {
      capturedCallbacks.onTranscriptFinal?.('How are you?')
    })
    expect(result.current.transcript).toBe('Hello world. How are you?')
  })

  it('error state set when mic permission denied', async () => {
    mockRequestPermission.mockResolvedValue('denied')

    const { result } = renderHook(() => useDeepgramSTT())

    await act(async () => {
      await result.current.startListening()
    })

    expect(result.current.isListening).toBe(false)
    expect(result.current.error).toBe('Microphone access denied. Check browser permissions.')
  })

  it('stopListening disconnects DeepgramClient and AudioCapture', async () => {
    const { result } = renderHook(() => useDeepgramSTT())

    await act(async () => {
      await result.current.startListening()
    })

    act(() => {
      result.current.stopListening()
    })

    expect(mockStop).toHaveBeenCalled()
    expect(mockDisconnect).toHaveBeenCalled()
  })
})
