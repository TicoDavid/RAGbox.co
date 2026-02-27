import React from 'react'
import { render } from '@testing-library/react'

// ── matchMedia mock (jsdom doesn't support it) ─────────────────
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
})

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

jest.mock('./sovereignStudio/SovereignStudioPanel', () => ({
  SovereignStudioPanel: () => <div data-testid="studio-panel" />,
}))

jest.mock('./chat', () => ({
  CenterChat: () => <div data-testid="center-chat" />,
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), prefetch: jest.fn() }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
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
