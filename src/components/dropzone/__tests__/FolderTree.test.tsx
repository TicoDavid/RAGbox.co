/**
 * Sarah — S-P0-02: FolderTree tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('../FolderNode', () => {
  return ({ folder, onSelect }: { folder: { id: string; name: string }; onSelect: (id: string) => void }) => (
    <div data-testid={`folder-${folder.id}`} onClick={() => onSelect(folder.id)}>{folder.name}</div>
  )
})

import FolderTree from '../FolderTree'

const folders = [
  { id: 'f1', name: 'Contracts', parentId: null, children: [], documentCount: 3 },
  { id: 'f2', name: 'Reports', parentId: null, children: [], documentCount: 5 },
]

describe('FolderTree', () => {
  const baseProps = { folders, selectedFolderId: null, onSelectFolder: jest.fn(), onCreateFolder: jest.fn(), onRenameFolder: jest.fn(), onDeleteFolder: jest.fn() }

  it('renders "Folders" header', () => {
    render(<FolderTree {...baseProps} />)
    expect(screen.getByText('Folders')).toBeTruthy()
  })

  it('renders "All Documents" button', () => {
    render(<FolderTree {...baseProps} />)
    expect(screen.getByText('All Documents')).toBeTruthy()
  })

  it('renders folder nodes', () => {
    render(<FolderTree {...baseProps} />)
    expect(screen.getByTestId('folder-f1')).toBeTruthy()
    expect(screen.getByTestId('folder-f2')).toBeTruthy()
  })

  it('calls onSelectFolder(null) when "All Documents" clicked', () => {
    const onSelectFolder = jest.fn()
    render(<FolderTree {...baseProps} onSelectFolder={onSelectFolder} />)
    fireEvent.click(screen.getByText('All Documents'))
    expect(onSelectFolder).toHaveBeenCalledWith(null)
  })

  it('shows new folder input on "+ New" click', () => {
    render(<FolderTree {...baseProps} />)
    fireEvent.click(screen.getByLabelText('Create new folder'))
    expect(screen.getByLabelText('New folder name')).toBeTruthy()
  })
})
