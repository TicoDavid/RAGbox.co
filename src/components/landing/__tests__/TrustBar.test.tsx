/**
 * Sarah — S-P0-02: TrustBar tests
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { TrustBar } from '../TrustBar'

describe('TrustBar', () => {
  it('renders all 5 trust items', () => {
    render(<TrustBar />)
    expect(screen.getByText('SOC 2 Ready')).toBeTruthy()
    expect(screen.getByText('HIPAA Compliant')).toBeTruthy()
    expect(screen.getByText('AES-256-GCM')).toBeTruthy()
    expect(screen.getByText('SEC 17a-4 Audit Trail')).toBeTruthy()
    expect(screen.getByText('Zero Data Retention')).toBeTruthy()
  })

  it('renders the security heading', () => {
    render(<TrustBar />)
    expect(screen.getByText('Enterprise-Grade Security')).toBeTruthy()
  })

  it('renders the tagline', () => {
    render(<TrustBar />)
    expect(screen.getByText('Your data never leaves your vault.')).toBeTruthy()
  })
})
