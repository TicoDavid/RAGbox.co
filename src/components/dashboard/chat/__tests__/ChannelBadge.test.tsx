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
})
