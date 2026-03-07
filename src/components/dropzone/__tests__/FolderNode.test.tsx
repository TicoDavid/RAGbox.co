/**
 * Sarah — S-P0-02: FolderNode tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return { ChevronRight: icon('chevron-right'), ChevronDown: icon('chevron-down'), Folder: icon('folder'), FolderOpen: icon('folder-open'), Trash2: icon('trash') }
})

import FolderNode from '../FolderNode'

const baseFolder = { id: 'f1', name: 'Contracts', parentId: null, children: [], documentCount: 5 }

describe('FolderNode', () => {
  const baseProps = { folder: baseFolder, depth: 0, selectedId: null, onSelect: jest.fn(), onRename: jest.fn(), onDelete: jest.fn() }

  beforeEach(() => jest.clearAllMocks())

  it('renders folder name', () => {
    render(<FolderNode {...baseProps} />)
    expect(screen.getByText('Contracts')).toBeTruthy()
  })

  it('renders document count', () => {
    render(<FolderNode {...baseProps} />)
    expect(screen.getByText('5')).toBeTruthy()
  })

  it('calls onSelect when clicked', () => {
    const onSelect = jest.fn()
    render(<FolderNode {...baseProps} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Contracts'))
    expect(onSelect).toHaveBeenCalledWith('f1')
  })

  it('calls onDelete when delete button clicked', () => {
    const onDelete = jest.fn()
    render(<FolderNode {...baseProps} onDelete={onDelete} />)
    fireEvent.click(screen.getByLabelText('Delete folder Contracts'))
    expect(onDelete).toHaveBeenCalledWith('f1')
  })

  it('shows expand button when folder has children', () => {
    const folder = { ...baseFolder, children: [{ id: 'f2', name: 'Sub', parentId: 'f1', children: [], documentCount: 2 }] }
    render(<FolderNode {...baseProps} folder={folder} />)
    expect(screen.getByLabelText('Expand folder')).toBeTruthy()
  })
})
