import React from 'react'
import { render, screen } from '@testing-library/react'
import { ChannelBadge } from '../ChannelBadge'

describe('ChannelBadge', () => {
  it('renders nothing when channel is undefined', () => {
    const { container } = render(<ChannelBadge />)
    expect(container.firstChild).toBeNull()
  })

  it('renders Chat badge for dashboard channel', () => {
    render(<ChannelBadge channel="dashboard" />)
    const badge = screen.getByText('Chat')
    expect(badge).toBeInTheDocument()
  })

  it('renders WhatsApp badge with label and green styling', () => {
    render(<ChannelBadge channel="whatsapp" />)
    const badge = screen.getByText('WhatsApp')
    expect(badge).toBeInTheDocument()
    expect(badge.closest('span')).toHaveClass('text-[var(--success)]')
  })

  it('renders Voice badge with label and purple styling', () => {
    render(<ChannelBadge channel="voice" />)
    const badge = screen.getByText('Voice')
    expect(badge).toBeInTheDocument()
    expect(badge.closest('span')).toHaveClass('text-purple-400')
  })

  it('renders Email badge with label and warning styling', () => {
    render(<ChannelBadge channel="email" />)
    const badge = screen.getByText('Email')
    expect(badge).toBeInTheDocument()
    expect(badge.closest('span')).toHaveClass('text-[var(--warning)]')
  })

  it('renders SMS badge with label and cyan styling', () => {
    render(<ChannelBadge channel="sms" />)
    const badge = screen.getByText('SMS')
    expect(badge).toBeInTheDocument()
    expect(badge.closest('span')).toHaveClass('text-cyan-400')
  })

  it('renders ROAM badge with label and orange styling', () => {
    render(<ChannelBadge channel="roam" />)
    const badge = screen.getByText('ROAM')
    expect(badge).toBeInTheDocument()
    expect(badge.closest('span')).toHaveClass('text-orange-400')
  })

  // ── SA-06: Extended tests ──────────────────────────────────────

  it('renders dashboard badge with blue brand color class', () => {
    render(<ChannelBadge channel="dashboard" />)
    const outer = screen.getByText('Chat').closest('span')
    expect(outer).toHaveClass('text-[var(--brand-blue)]')
    expect(outer).toHaveClass('bg-[var(--brand-blue)]/15')
  })

  it('renders SMS badge with correct emoji', () => {
    const { container } = render(<ChannelBadge channel="sms" />)
    const spans = container.querySelectorAll('span span')
    // First inner span is the emoji
    expect(spans[0].textContent).toBe('\uD83D\uDCAC')
  })

  it('renders ROAM badge with orange circle emoji', () => {
    const { container } = render(<ChannelBadge channel="roam" />)
    const spans = container.querySelectorAll('span span')
    expect(spans[0].textContent).toBe('\uD83D\uDFE0')
  })

  it('applies rounded-full pill styling to all badges', () => {
    render(<ChannelBadge channel="voice" />)
    const outer = screen.getByText('Voice').closest('span')
    expect(outer).toHaveClass('rounded-full')
    expect(outer).toHaveClass('inline-flex')
    expect(outer).toHaveClass('items-center')
    expect(outer).toHaveClass('text-[10px]')
    expect(outer).toHaveClass('font-medium')
  })

  it('renders each channel with a unique label (no duplicates in output)', () => {
    const channels = ['dashboard', 'whatsapp', 'voice', 'email', 'sms', 'roam'] as const
    const labels = new Set<string>()
    channels.forEach((ch) => {
      const { unmount } = render(<ChannelBadge channel={ch} />)
      const text = screen.getByText(/\w+/).textContent
      labels.add(text || '')
      unmount()
    })
    // All 6 channels should produce 6 unique labels
    expect(labels.size).toBe(6)
  })
})
