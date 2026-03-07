/**
 * Sarah — S-P0-02: StorageIndicator tests
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import StorageIndicator from '../StorageIndicator'

describe('StorageIndicator', () => {
  it('renders "Storage" label', () => {
    render(<StorageIndicator usedBytes={500000} maxBytes={1073741824} />)
    expect(screen.getByText('Storage')).toBeTruthy()
  })

  it('renders formatted used and max bytes', () => {
    render(<StorageIndicator usedBytes={5242880} maxBytes={1073741824} />)
    expect(screen.getByText(/5.*MB/)).toBeTruthy()
    expect(screen.getByText(/1.*GB/)).toBeTruthy()
  })

  it('renders progressbar', () => {
    render(<StorageIndicator usedBytes={500} maxBytes={1000} />)
    expect(screen.getByRole('progressbar')).toBeTruthy()
  })

  it('sets aria-valuenow to percentage', () => {
    render(<StorageIndicator usedBytes={500} maxBytes={1000} />)
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('50')
  })
})
