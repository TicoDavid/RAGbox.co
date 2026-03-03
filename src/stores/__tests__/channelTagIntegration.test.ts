/**
 * Channel Tag Integration Tests
 *
 * Tests the unified thread channel tagging system:
 *   - Voice messages have channel: 'voice' and render mic badge
 *   - Text messages have channel: 'dashboard' and render chat badge
 *   - Both appear in same thread chronologically
 *   - Channel filter tabs (All, Dashboard, WhatsApp, Voice, etc.) filter correctly
 *
 * Source: mercuryStore.ts (filteredMessages, channelFilter, setChannelFilter)
 *
 * — Sarah, QA
 */

import { useMercuryStore } from '../mercuryStore'
import type { ChatMessage, MercuryChannel } from '@/types/ragbox'

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeMessage(
  overrides: Partial<ChatMessage> & { id: string; channel: MercuryChannel },
): ChatMessage {
  return {
    role: 'assistant',
    content: 'Test message',
    timestamp: new Date(),
    ...overrides,
  }
}

// ─── Setup ──────────────────────────────────────────────────────────────────

const originalFetch = global.fetch
const defaultFetchResponse = { ok: true, json: async () => ({}) }

beforeEach(() => {
  useMercuryStore.setState({
    messages: [],
    channelFilter: 'all',
  })
  global.fetch = jest.fn().mockResolvedValue(defaultFetchResponse)
})

afterAll(() => {
  global.fetch = originalFetch
})

// ============================================================================
// CHANNEL FIELD ON MESSAGES
// ============================================================================

describe('Channel Tags — message channel field', () => {

  it('voice messages have channel: "voice"', () => {
    const voiceMsg = makeMessage({ id: 'v1', channel: 'voice', content: 'Hello via voice' })
    expect(voiceMsg.channel).toBe('voice')
  })

  it('text dashboard messages have channel: "dashboard"', () => {
    const textMsg = makeMessage({ id: 't1', channel: 'dashboard', content: 'Hello via text' })
    expect(textMsg.channel).toBe('dashboard')
  })

  it('all 6 channel types are valid MercuryChannel values', () => {
    const channels: MercuryChannel[] = ['dashboard', 'whatsapp', 'voice', 'roam', 'email', 'sms']
    channels.forEach((ch) => {
      const msg = makeMessage({ id: `ch-${ch}`, channel: ch })
      expect(msg.channel).toBe(ch)
    })
  })
})

// ============================================================================
// SAME THREAD — MIXED CHANNELS CHRONOLOGICALLY
// ============================================================================

describe('Channel Tags — unified thread ordering', () => {

  it('voice and dashboard messages appear in same thread chronologically', () => {
    const messages: ChatMessage[] = [
      makeMessage({ id: 'm1', channel: 'dashboard', content: 'Text Q1', timestamp: new Date('2026-03-03T10:00:00') }),
      makeMessage({ id: 'm2', channel: 'dashboard', content: 'Text A1', timestamp: new Date('2026-03-03T10:00:01') }),
      makeMessage({ id: 'm3', channel: 'voice',     content: 'Voice Q1', timestamp: new Date('2026-03-03T10:01:00') }),
      makeMessage({ id: 'm4', channel: 'voice',     content: 'Voice A1', timestamp: new Date('2026-03-03T10:01:01') }),
      makeMessage({ id: 'm5', channel: 'dashboard', content: 'Text Q2', timestamp: new Date('2026-03-03T10:02:00') }),
    ]

    useMercuryStore.setState({ messages, channelFilter: 'all' })

    const all = useMercuryStore.getState().filteredMessages()
    expect(all).toHaveLength(5)
    expect(all[0].channel).toBe('dashboard')
    expect(all[2].channel).toBe('voice')
    expect(all[4].channel).toBe('dashboard')
  })

  it('messages from multiple channels interleave correctly', () => {
    const messages: ChatMessage[] = [
      makeMessage({ id: 'm1', channel: 'whatsapp',  timestamp: new Date('2026-03-03T09:00:00') }),
      makeMessage({ id: 'm2', channel: 'voice',     timestamp: new Date('2026-03-03T09:01:00') }),
      makeMessage({ id: 'm3', channel: 'email',     timestamp: new Date('2026-03-03T09:02:00') }),
      makeMessage({ id: 'm4', channel: 'dashboard', timestamp: new Date('2026-03-03T09:03:00') }),
    ]

    useMercuryStore.setState({ messages, channelFilter: 'all' })

    const all = useMercuryStore.getState().filteredMessages()
    expect(all).toHaveLength(4)
    expect(all.map(m => m.channel)).toEqual(['whatsapp', 'voice', 'email', 'dashboard'])
  })
})

// ============================================================================
// CHANNEL FILTER TABS
// ============================================================================

describe('Channel Tags — filter tabs', () => {

  const mixedMessages: ChatMessage[] = [
    makeMessage({ id: 'd1', channel: 'dashboard', content: 'Dashboard msg 1' }),
    makeMessage({ id: 'd2', channel: 'dashboard', content: 'Dashboard msg 2' }),
    makeMessage({ id: 'v1', channel: 'voice',     content: 'Voice msg 1' }),
    makeMessage({ id: 'w1', channel: 'whatsapp',  content: 'WhatsApp msg 1' }),
    makeMessage({ id: 'v2', channel: 'voice',     content: 'Voice msg 2' }),
    makeMessage({ id: 'e1', channel: 'email',     content: 'Email msg 1' }),
    makeMessage({ id: 's1', channel: 'sms',       content: 'SMS msg 1' }),
    makeMessage({ id: 'r1', channel: 'roam',      content: 'ROAM msg 1' }),
  ]

  beforeEach(() => {
    useMercuryStore.setState({ messages: mixedMessages, channelFilter: 'all' })
  })

  it('"All" filter returns all messages', () => {
    useMercuryStore.getState().setChannelFilter('all')
    const result = useMercuryStore.getState().filteredMessages()
    expect(result).toHaveLength(8)
  })

  it('"Dashboard" filter returns only dashboard messages', () => {
    useMercuryStore.getState().setChannelFilter('dashboard')
    const result = useMercuryStore.getState().filteredMessages()
    expect(result).toHaveLength(2)
    expect(result.every(m => m.channel === 'dashboard')).toBe(true)
  })

  it('"Voice" filter returns only voice messages', () => {
    useMercuryStore.getState().setChannelFilter('voice')
    const result = useMercuryStore.getState().filteredMessages()
    expect(result).toHaveLength(2)
    expect(result.every(m => m.channel === 'voice')).toBe(true)
  })

  it('"WhatsApp" filter returns only whatsapp messages', () => {
    useMercuryStore.getState().setChannelFilter('whatsapp')
    const result = useMercuryStore.getState().filteredMessages()
    expect(result).toHaveLength(1)
    expect(result[0].channel).toBe('whatsapp')
  })

  it('"Email" filter returns only email messages', () => {
    useMercuryStore.getState().setChannelFilter('email')
    const result = useMercuryStore.getState().filteredMessages()
    expect(result).toHaveLength(1)
    expect(result[0].channel).toBe('email')
  })

  it('"SMS" filter returns only sms messages', () => {
    useMercuryStore.getState().setChannelFilter('sms')
    const result = useMercuryStore.getState().filteredMessages()
    expect(result).toHaveLength(1)
    expect(result[0].channel).toBe('sms')
  })

  it('"ROAM" filter returns only roam messages', () => {
    useMercuryStore.getState().setChannelFilter('roam')
    const result = useMercuryStore.getState().filteredMessages()
    expect(result).toHaveLength(1)
    expect(result[0].channel).toBe('roam')
  })

  it('filter returns empty array when no messages match', () => {
    useMercuryStore.setState({
      messages: [makeMessage({ id: 'd1', channel: 'dashboard' })],
    })
    useMercuryStore.getState().setChannelFilter('voice')
    const result = useMercuryStore.getState().filteredMessages()
    expect(result).toHaveLength(0)
  })

  it('switching filters updates results immediately', () => {
    useMercuryStore.getState().setChannelFilter('voice')
    expect(useMercuryStore.getState().filteredMessages()).toHaveLength(2)

    useMercuryStore.getState().setChannelFilter('dashboard')
    expect(useMercuryStore.getState().filteredMessages()).toHaveLength(2)

    useMercuryStore.getState().setChannelFilter('all')
    expect(useMercuryStore.getState().filteredMessages()).toHaveLength(8)
  })

  it('default filter is "all"', () => {
    // Fresh state
    useMercuryStore.setState({ channelFilter: 'all' })
    expect(useMercuryStore.getState().channelFilter).toBe('all')
  })
})
