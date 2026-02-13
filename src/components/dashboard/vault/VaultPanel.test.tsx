import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'

// ── Mocks ──────────────────────────────────────────────────────

const mockFetchDocuments = jest.fn().mockResolvedValue(undefined)
const mockFetchFolders = jest.fn().mockResolvedValue(undefined)
const mockToggleCollapse = jest.fn()

let mockIsCollapsed = false

jest.mock('@/stores/vaultStore', () => ({
  useVaultStore: jest.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      isCollapsed: mockIsCollapsed,
      toggleCollapse: mockToggleCollapse,
      fetchDocuments: mockFetchDocuments,
      fetchFolders: mockFetchFolders,
      uploadDocument: jest.fn(),
      currentPath: [],
    }),
  ),
}))

jest.mock('./VaultRail', () => ({
  VaultRail: (props: { onExpand: () => void }) => (
    <div data-testid="vault-rail" onClick={props.onExpand} />
  ),
}))

jest.mock('./ColumnBrowser', () => ({
  ColumnBrowser: () => <div data-testid="column-browser" />,
}))

jest.mock('./StorageFooter', () => ({
  StorageFooter: () => <div data-testid="storage-footer" />,
}))

import { VaultPanel } from './VaultPanel'

// ── Tests ───────────────────────────────────────────────────────

describe('VaultPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsCollapsed = false
    // Reset the hasFetched ref by re-importing (jest module isolation handles this)
  })

  test('calls fetchDocuments and fetchFolders on mount', async () => {
    render(<VaultPanel />)
    expect(mockFetchDocuments).toHaveBeenCalledTimes(1)
    await waitFor(() => {
      expect(mockFetchFolders).toHaveBeenCalledTimes(1)
    })
  })

  test('fetchFolders is called only after fetchDocuments resolves', async () => {
    const callOrder: string[] = []

    mockFetchDocuments.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          callOrder.push('fetchDocuments:start')
          setTimeout(() => {
            callOrder.push('fetchDocuments:end')
            resolve()
          }, 10)
        }),
    )

    mockFetchFolders.mockImplementation(() => {
      callOrder.push('fetchFolders:start')
      return Promise.resolve()
    })

    render(<VaultPanel />)

    // Wait for all promises to settle
    await new Promise((r) => setTimeout(r, 50))

    expect(callOrder).toEqual([
      'fetchDocuments:start',
      'fetchDocuments:end',
      'fetchFolders:start',
    ])
  })

  test('renders VaultRail when collapsed', () => {
    mockIsCollapsed = true
    render(<VaultPanel />)
    expect(screen.getByTestId('vault-rail')).toBeInTheDocument()
  })
})
