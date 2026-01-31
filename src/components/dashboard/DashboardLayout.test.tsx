import React from 'react'
import { render } from '@testing-library/react'

// ── Mocks ──────────────────────────────────────────────────────

jest.mock('@/stores/vaultStore', () => ({
  useVaultStore: jest.fn(() => false),
}))

const mockFetchPrivilege = jest.fn()

jest.mock('@/stores/privilegeStore', () => ({
  usePrivilegeStore: jest.fn((selector: (s: { fetch: () => void }) => unknown) =>
    selector({ fetch: mockFetchPrivilege }),
  ),
}))

jest.mock('./GlobalHeader', () => ({
  GlobalHeader: () => <div data-testid="global-header" />,
}))

jest.mock('./vault/VaultPanel', () => ({
  VaultPanel: () => <div data-testid="vault-panel" />,
}))

jest.mock('./mercury/MercuryPanel', () => ({
  MercuryPanel: () => <div data-testid="mercury-panel" />,
}))

jest.mock('./forge/ForgePanel', () => ({
  ForgePanel: () => <div data-testid="forge-panel" />,
}))

import { DashboardLayout } from './DashboardLayout'

// ── Tests ───────────────────────────────────────────────────────

describe('DashboardLayout', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('calls privilegeStore.fetch() on mount', () => {
    render(<DashboardLayout />)
    expect(mockFetchPrivilege).toHaveBeenCalledTimes(1)
  })
})
