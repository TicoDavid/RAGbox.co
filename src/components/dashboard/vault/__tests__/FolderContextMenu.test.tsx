/**
 * Sarah — S-P0-02: FolderContextMenu tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return { Pencil: icon('pencil'), Trash2: icon('trash'), FolderPlus: icon('folder-plus'), Palette: icon('palette') }
})

import { FolderContextMenu } from '../FolderContextMenu'

const baseProps = {
  x: 100,
  y: 200,
  folderId: 'f1',
  folderName: 'Contracts',
  onRename: jest.fn(),
  onDelete: jest.fn(),
  onNewSubfolder: jest.fn(),
  onSetColor: jest.fn(),
  onClose: jest.fn(),
}

describe('FolderContextMenu', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders Rename option', () => {
    render(<FolderContextMenu {...baseProps} />)
    expect(screen.getByText('Rename')).toBeTruthy()
  })

  it('renders New subfolder option', () => {
    render(<FolderContextMenu {...baseProps} />)
    expect(screen.getByText('New subfolder')).toBeTruthy()
  })

  it('renders Delete option', () => {
    render(<FolderContextMenu {...baseProps} />)
    expect(screen.getByText('Delete')).toBeTruthy()
  })

  it('calls onRename and onClose on Rename click', () => {
    render(<FolderContextMenu {...baseProps} />)
    fireEvent.click(screen.getByText('Rename'))
    expect(baseProps.onRename).toHaveBeenCalled()
    expect(baseProps.onClose).toHaveBeenCalled()
  })

  it('calls onDelete and onClose on Delete click (with confirmation)', () => {
    render(<FolderContextMenu {...baseProps} />)
    // First click shows confirmation dialog
    fireEvent.click(screen.getByText('Delete'))
    expect(baseProps.onDelete).not.toHaveBeenCalled()
    // Second click on confirm button triggers actual delete
    const confirmBtn = screen.getAllByText('Delete').find(
      (el) => el.closest('button')?.classList.contains('bg-[var(--danger)]')
    )
    expect(confirmBtn).toBeTruthy()
    fireEvent.click(confirmBtn!)
    expect(baseProps.onDelete).toHaveBeenCalled()
    expect(baseProps.onClose).toHaveBeenCalled()
  })

  it('calls onNewSubfolder and onClose on New subfolder click', () => {
    render(<FolderContextMenu {...baseProps} />)
    fireEvent.click(screen.getByText('New subfolder'))
    expect(baseProps.onNewSubfolder).toHaveBeenCalled()
    expect(baseProps.onClose).toHaveBeenCalled()
  })
})
