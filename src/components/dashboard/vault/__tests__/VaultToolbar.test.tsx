/**
 * Sarah — EPIC-032 T3: VaultToolbar tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(
      ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLDivElement>) => (
        <div ref={ref} {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
      ),
    ),
  },
}))

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    Upload: icon('upload'),
    FolderPlus: icon('folder-plus'),
    ArrowUpDown: icon('arrow-up-down'),
    List: icon('list'),
    LayoutGrid: icon('layout-grid'),
    Maximize2: icon('maximize'),
    X: icon('x'),
    Trash2: icon('trash'),
    FolderInput: icon('folder-input'),
    Check: icon('check'),
    ChevronDown: icon('chevron-down'),
  }
})

jest.mock('../PipelineQueueBadge', () => ({
  PipelineQueueBadge: () => <div data-testid="pipeline-queue-badge" />,
}))

import { VaultToolbar } from '../VaultToolbar'

describe('VaultToolbar', () => {
  const defaultProps = {
    viewMode: 'list' as const,
    sortField: 'date' as const,
    sortDirection: 'desc' as const,
    selectedCount: 0,
    onUpload: jest.fn(),
    onNewFolder: jest.fn(),
    onSetViewMode: jest.fn(),
    onSetSort: jest.fn(),
    onOpenExplorer: jest.fn(),
    onDeleteSelected: jest.fn(),
    onMoveSelected: jest.fn(),
    onClearSelection: jest.fn(),
  }

  beforeEach(() => jest.clearAllMocks())

  it('renders all action buttons (Upload, New Folder, Sort, View, Explorer)', () => {
    render(<VaultToolbar {...defaultProps} />)
    expect(screen.getByLabelText('Upload files')).toBeTruthy()
    expect(screen.getByLabelText('Create new folder')).toBeTruthy()
    expect(screen.getByLabelText('Sort documents')).toBeTruthy()
    expect(screen.getByLabelText('List view')).toBeTruthy()
    expect(screen.getByLabelText('Grid view')).toBeTruthy()
    expect(screen.getByLabelText('Open explorer')).toBeTruthy()
  })

  it('sort dropdown opens on click', () => {
    render(<VaultToolbar {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('Sort documents'))
    expect(screen.getByText('Name (A→Z)')).toBeTruthy()
    expect(screen.getByText('Name (Z→A)')).toBeTruthy()
    expect(screen.getByText('Date (Oldest)')).toBeTruthy()
    // "Date (Newest)" appears both in the sort button label and dropdown
    expect(screen.getAllByText('Date (Newest)').length).toBeGreaterThanOrEqual(1)
  })

  it('sort options change sort order via callback', () => {
    render(<VaultToolbar {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('Sort documents'))
    fireEvent.click(screen.getByText('Name (A→Z)'))
    expect(defaultProps.onSetSort).toHaveBeenCalledWith('name', 'asc')
  })

  it('view toggle switches between list and grid', () => {
    render(<VaultToolbar {...defaultProps} />)
    fireEvent.click(screen.getByLabelText('Grid view'))
    expect(defaultProps.onSetViewMode).toHaveBeenCalledWith('grid')
  })

  it('view toggle switches from grid to list', () => {
    render(<VaultToolbar {...defaultProps} viewMode="grid" />)
    fireEvent.click(screen.getByLabelText('List view'))
    expect(defaultProps.onSetViewMode).toHaveBeenCalledWith('list')
  })

  it('keyboard shortcut "u" triggers upload', () => {
    render(<VaultToolbar {...defaultProps} />)
    fireEvent.keyDown(window, { key: 'u' })
    expect(defaultProps.onUpload).toHaveBeenCalled()
  })

  it('keyboard shortcut "n" triggers new folder', () => {
    render(<VaultToolbar {...defaultProps} />)
    fireEvent.keyDown(window, { key: 'n' })
    expect(defaultProps.onNewFolder).toHaveBeenCalled()
  })

  it('keyboard shortcut "g" toggles view', () => {
    render(<VaultToolbar {...defaultProps} />)
    fireEvent.keyDown(window, { key: 'g' })
    expect(defaultProps.onSetViewMode).toHaveBeenCalledWith('grid')
  })

  it('contextual actions appear when items selected', () => {
    render(<VaultToolbar {...defaultProps} selectedCount={3} />)
    expect(screen.getByText('Move')).toBeTruthy()
    expect(screen.getByText('Delete')).toBeTruthy()
    // Upload button should not be visible in selection mode
    expect(screen.queryByLabelText('Upload files')).toBeNull()
  })

  it('selection count badge shows correct number', () => {
    render(<VaultToolbar {...defaultProps} selectedCount={5} />)
    expect(screen.getByText('5 selected')).toBeTruthy()
  })

  it('upload button has brand-blue styling', () => {
    render(<VaultToolbar {...defaultProps} />)
    const uploadButton = screen.getByLabelText('Upload files')
    expect(uploadButton.className).toContain('brand-blue')
  })

  it('does not fire keyboard shortcuts when typing in input', () => {
    const { container } = render(
      <div>
        <VaultToolbar {...defaultProps} />
        <input data-testid="text-input" />
      </div>,
    )
    const input = screen.getByTestId('text-input')
    fireEvent.keyDown(input, { key: 'u' })
    expect(defaultProps.onUpload).not.toHaveBeenCalled()
  })
})
