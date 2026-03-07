/**
 * Sarah — S-P0-02: StorageFooter tests
 */

import React from 'react'
import { render, screen } from '@testing-library/react'

let mockStorage = { used: 5242880, total: 1073741824 } // 5MB used of 1GB

jest.mock('@/stores/vaultStore', () => ({
  useVaultStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ storage: mockStorage }),
}))

import { StorageFooter } from '../StorageFooter'

describe('StorageFooter', () => {
  it('renders used storage in MB', () => {
    render(<StorageFooter />)
    expect(screen.getByText('5 MB used')).toBeTruthy()
  })

  it('renders total storage in GB', () => {
    render(<StorageFooter />)
    expect(screen.getByText('1.0 GB')).toBeTruthy()
  })

  it('renders the progress bar', () => {
    const { container } = render(<StorageFooter />)
    expect(container.querySelector('.rounded-full')).toBeTruthy()
  })
})
