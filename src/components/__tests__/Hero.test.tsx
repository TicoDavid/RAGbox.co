/**
 * Sarah — S-P0-02: Hero tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))

import Hero from '../Hero'

describe('Hero', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders headline text', () => {
    render(<Hero onOpenAuth={jest.fn()} />)
    expect(screen.getByText('Your Documents.')).toBeTruthy()
    expect(screen.getByText('Interrogated.')).toBeTruthy()
  })

  it('renders trust badges', () => {
    render(<Hero onOpenAuth={jest.fn()} />)
    expect(screen.getByText('Instant Utility')).toBeTruthy()
    expect(screen.getByText('Enterprise-Grade Shielding')).toBeTruthy()
    expect(screen.getByText('Total Sovereignty')).toBeTruthy()
  })

  it('renders "Start Free" button that navigates', () => {
    render(<Hero onOpenAuth={jest.fn()} />)
    fireEvent.click(screen.getByText('Start Free'))
    expect(mockPush).toHaveBeenCalledWith('/onboarding/plan')
  })

  it('renders "Watch Demo" button', () => {
    render(<Hero onOpenAuth={jest.fn()} />)
    expect(screen.getByText('Watch Demo')).toBeTruthy()
  })

  it('renders subtitle', () => {
    render(<Hero onOpenAuth={jest.fn()} />)
    expect(screen.getByText(/Upload anything. Ask everything/)).toBeTruthy()
  })
})
