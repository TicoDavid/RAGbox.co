/**
 * Sarah — S-P0-02: ModelBadge + formatModelLabel tests
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { ModelBadge, formatModelLabel } from '../ModelBadge'

describe('formatModelLabel', () => {
  it('strips provider prefix', () => {
    expect(formatModelLabel('deepseek/deepseek-chat-v3.1')).toBe('DeepSeek V3.1')
  })

  it('maps known models to friendly names', () => {
    expect(formatModelLabel('claude-3.5-sonnet')).toBe('Claude 3.5 Sonnet')
    expect(formatModelLabel('gpt-4o')).toBe('GPT-4o')
    expect(formatModelLabel('gemini-2.5-pro')).toBe('Gemini 2.5 Pro')
  })

  it('title-cases unknown models', () => {
    expect(formatModelLabel('my-custom-model')).toBe('My Custom Model')
  })
})

describe('ModelBadge', () => {
  it('returns null when modelUsed is undefined', () => {
    const { container } = render(<ModelBadge />)
    expect(container.innerHTML).toBe('')
  })

  it('shows ConnexUS AEGIS for aegis provider', () => {
    render(<ModelBadge modelUsed="gemini-2.5-flash" provider="aegis" />)
    expect(screen.getByText(/ConnexUS AEGIS/)).toBeTruthy()
  })

  it('shows ConnexUS AEGIS when no provider (default routing)', () => {
    render(<ModelBadge modelUsed="gemini-2.5-flash" />)
    expect(screen.getByText(/ConnexUS AEGIS/)).toBeTruthy()
  })

  it('shows real model name for openrouter provider (BYOLLM)', () => {
    render(<ModelBadge modelUsed="gpt-4o" provider="openrouter" />)
    expect(screen.getByText(/GPT-4o/)).toBeTruthy()
  })

  it('appends latency when provided', () => {
    render(<ModelBadge modelUsed="aegis" provider="aegis" latencyMs={1500} />)
    expect(screen.getByText(/1\.5s/)).toBeTruthy()
  })

  it('does not show latency when not provided', () => {
    render(<ModelBadge modelUsed="aegis" provider="aegis" />)
    expect(screen.queryByText(/\ds/)).toBeNull()
  })
})
