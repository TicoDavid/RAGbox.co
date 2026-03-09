/**
 * Sarah — EPIC-032 T7: BatchActionBar tests
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// ── Mock vaultStore ──────────────────────────────────────────

const mockBatchDelete = jest.fn(() => Promise.resolve())
const mockBatchMove = jest.fn(() => Promise.resolve())
const mockBatchUpdateTier = jest.fn(() => Promise.resolve())
const mockClearSelection = jest.fn()
const mockSelectAll = jest.fn()

let mockSelectedIds: string[] = []
let mockFolders: Record<string, unknown> = {}

jest.mock('@/stores/vaultStore', () => ({
  useVaultStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({
      selectedDocumentIds: mockSelectedIds,
      clearSelection: mockClearSelection,
      selectAll: mockSelectAll,
      folders: mockFolders,
      batchDelete: mockBatchDelete,
      batchMove: mockBatchMove,
      batchUpdateTier: mockBatchUpdateTier,
    }),
}))

jest.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(
      ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLDivElement>) => (
        <div ref={ref} {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
      ),
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}))

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    CheckSquare: icon('check-square'),
    FolderInput: icon('folder-input'),
    Trash2: icon('trash'),
    Shield: icon('shield'),
    X: icon('x'),
  }
})

import { BatchActionBar } from '../BatchActionBar'

describe('BatchActionBar', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSelectedIds = ['doc-1', 'doc-2', 'doc-3']
    mockFolders = {
      'f1': { id: 'f1', name: 'Contracts', children: [], documents: [] },
      'f2': { id: 'f2', name: 'Reports', parentId: 'f1', children: [], documents: [] },
    }
  })

  it('renders when items selected (count > 0)', () => {
    render(<BatchActionBar />)
    expect(screen.getByText('3 selected')).toBeTruthy()
  })

  it('does not render when no items selected', () => {
    mockSelectedIds = []
    const { container } = render(<BatchActionBar />)
    expect(container.querySelector('[class*="absolute"]')).toBeNull()
  })

  it('shows correct selection count', () => {
    mockSelectedIds = ['a', 'b', 'c', 'd', 'e']
    render(<BatchActionBar />)
    expect(screen.getByText('5 selected')).toBeTruthy()
  })

  it('"Move to" opens folder picker', () => {
    render(<BatchActionBar />)
    fireEvent.click(screen.getByText('Move to...'))
    // Should show root folders (f1 has no parentId)
    expect(screen.getByText('Contracts')).toBeTruthy()
  })

  it('"Delete" shows confirmation dialog', () => {
    render(<BatchActionBar />)
    fireEvent.click(screen.getByText('Delete'))
    expect(screen.getByText(/Delete 3 items?/)).toBeTruthy()
  })

  it('"Change Tier" opens tier dropdown', () => {
    render(<BatchActionBar />)
    fireEvent.click(screen.getByText('Tier'))
    expect(screen.getByText('Standard')).toBeTruthy()
    expect(screen.getByText('Confidential')).toBeTruthy()
    expect(screen.getByText('Restricted')).toBeTruthy()
  })

  it('cancel (X) clears all selections', () => {
    render(<BatchActionBar />)
    fireEvent.click(screen.getByLabelText('Clear selection'))
    expect(mockClearSelection).toHaveBeenCalled()
  })

  it('batch delete calls API with correct IDs', async () => {
    render(<BatchActionBar />)
    fireEvent.click(screen.getByText('Delete'))
    // Click confirm in the dialog
    const confirmButtons = screen.getAllByText('Delete')
    const confirmBtn = confirmButtons[confirmButtons.length - 1]
    fireEvent.click(confirmBtn)
    await waitFor(() => {
      expect(mockBatchDelete).toHaveBeenCalledWith(['doc-1', 'doc-2', 'doc-3'])
    })
  })

  it('batch move calls API with IDs + folderId', async () => {
    render(<BatchActionBar />)
    fireEvent.click(screen.getByText('Move to...'))
    fireEvent.click(screen.getByText('Contracts'))
    await waitFor(() => {
      expect(mockBatchMove).toHaveBeenCalledWith(['doc-1', 'doc-2', 'doc-3'], 'f1')
    })
  })

  it('batch tier update calls with correct tier', async () => {
    render(<BatchActionBar />)
    fireEvent.click(screen.getByText('Tier'))
    fireEvent.click(screen.getByText('Confidential'))
    await waitFor(() => {
      expect(mockBatchUpdateTier).toHaveBeenCalledWith(['doc-1', 'doc-2', 'doc-3'], 3)
    })
  })

  it('keyboard: Ctrl+A selects all', () => {
    render(<BatchActionBar />)
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true })
    expect(mockSelectAll).toHaveBeenCalled()
  })

  it('keyboard: Escape clears selection', () => {
    render(<BatchActionBar />)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(mockClearSelection).toHaveBeenCalled()
  })

  it('keyboard: Delete triggers batch delete confirmation', () => {
    render(<BatchActionBar />)
    fireEvent.keyDown(window, { key: 'Delete' })
    expect(screen.getByText(/Delete 3 item/)).toBeTruthy()
  })

  it('shows "No folders" when no root folders exist', () => {
    mockFolders = {}
    render(<BatchActionBar />)
    fireEvent.click(screen.getByText('Move to...'))
    expect(screen.getByText('No folders')).toBeTruthy()
  })
})
