/**
 * Sarah — S-P0-02: MercuryUpgradeCard tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    Mic: icon('mic'),
    Zap: icon('zap'),
    MessageCircle: icon('message-circle'),
    Brain: icon('brain'),
    Users: icon('users'),
  }
})

import { MercuryUpgradeCard } from '../MercuryUpgradeCard'

describe('MercuryUpgradeCard', () => {
  it('renders title', () => {
    render(<MercuryUpgradeCard />)
    expect(screen.getByText('Mercury AI Assistant')).toBeTruthy()
  })

  it('renders 4 feature items', () => {
    render(<MercuryUpgradeCard />)
    expect(screen.getByText('Voice AI Agent')).toBeTruthy()
    expect(screen.getByText('Conversation Memory')).toBeTruthy()
    expect(screen.getByText('Multi-Channel')).toBeTruthy()
    expect(screen.getByText('Neural Shift Personas')).toBeTruthy()
  })

  it('renders upgrade button', () => {
    render(<MercuryUpgradeCard />)
    expect(screen.getByText('Upgrade to Unlock Mercury')).toBeTruthy()
  })

  it('calls onUpgrade when button clicked', () => {
    const onUpgrade = jest.fn()
    render(<MercuryUpgradeCard onUpgrade={onUpgrade} />)
    fireEvent.click(screen.getByText('Upgrade to Unlock Mercury'))
    expect(onUpgrade).toHaveBeenCalled()
  })

  it('renders plan info', () => {
    render(<MercuryUpgradeCard />)
    expect(screen.getByText(/Available on Starter plan/)).toBeTruthy()
  })
})
