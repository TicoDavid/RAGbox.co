/**
 * Sarah — S-P0-02: ActiveModelBadge tests
 */

import React from 'react'
import { render, screen } from '@testing-library/react'

let mockIsAegisActive = true

jest.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({ isAegisActive: mockIsAegisActive }),
}))

import { ActiveModelBadge } from '../ActiveModelBadge'

describe('ActiveModelBadge', () => {
  it('renders M.E.R.C.U.R.Y. text', () => {
    render(<ActiveModelBadge />)
    expect(screen.getByText('M.E.R.C.U.R.Y.')).toBeTruthy()
  })

  it('renders when AEGIS is active', () => {
    mockIsAegisActive = true
    render(<ActiveModelBadge />)
    expect(screen.getByText('M.E.R.C.U.R.Y.')).toBeTruthy()
  })

  it('renders when AEGIS is not active', () => {
    mockIsAegisActive = false
    render(<ActiveModelBadge />)
    expect(screen.getByText('M.E.R.C.U.R.Y.')).toBeTruthy()
  })
})
