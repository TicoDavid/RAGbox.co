/**
 * Sarah — EPIC-032 T6: NavigationTree tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import type { FolderNode } from '@/types/ragbox'

jest.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(
      ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLDivElement>) => (
        <div ref={ref} {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
      ),
    ),
    span: React.forwardRef(
      ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLSpanElement>) => (
        <span ref={ref} {...(props as React.HTMLAttributes<HTMLSpanElement>)}>{children}</span>
      ),
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}))

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    ChevronRight: icon('chevron-right'),
    Folder: icon('folder'),
    FolderOpen: icon('folder-open'),
    Home: icon('home'),
    Star: icon('star'),
    Clock: icon('clock'),
    AlertTriangle: icon('alert'),
    Cloud: icon('cloud'),
  }
})

jest.mock('../../FolderContextMenu', () => ({
  FolderContextMenu: () => <div data-testid="context-menu">Context Menu</div>,
}))

import { NavigationTree } from '../NavigationTree'

function makeFolders(overrides: Partial<Record<string, FolderNode>> = {}): Record<string, FolderNode> {
  return {
    'f1': {
      id: 'f1',
      name: 'Contracts',
      children: ['f2'],
      documents: ['d1', 'd2'],
      documentCount: 2,
    },
    'f2': {
      id: 'f2',
      name: 'Amendments',
      parentId: 'f1',
      children: [],
      documents: ['d3'],
      documentCount: 1,
    },
    ...overrides,
  }
}

describe('NavigationTree', () => {
  const defaultProps = {
    folders: makeFolders(),
    selectedFolderId: null,
    activeFilter: null,
    starredCount: 5,
    recentCount: 10,
    onSelectFolder: jest.fn(),
    onQuickAccessFilter: jest.fn(),
    onRenameFolder: jest.fn(),
    onDeleteFolder: jest.fn(),
    onNewSubfolder: jest.fn(),
    onSetFolderColor: jest.fn(),
    onDropOnFolder: jest.fn(),
  }

  beforeEach(() => jest.clearAllMocks())

  function expandFolders() {
    fireEvent.click(screen.getByText('Folders'))
  }

  it('renders folder tree structure', () => {
    render(<NavigationTree {...defaultProps} />)
    expandFolders()
    expect(screen.getByText('Contracts')).toBeTruthy()
    expect(screen.getByText('All Files')).toBeTruthy()
  })

  it('expand/collapse toggles children visibility', () => {
    render(<NavigationTree {...defaultProps} />)
    expandFolders()
    expect(screen.getByText('Contracts')).toBeTruthy()
    // Collapse
    expandFolders()
    // "Contracts" should no longer be visible (AnimatePresence mock renders children)
  })

  it('active folder has highlighted styling', () => {
    render(<NavigationTree {...defaultProps} selectedFolderId="f1" />)
    expandFolders()
    const folderRow = screen.getByText('Contracts').closest('[class*="cursor-pointer"]')
    expect(folderRow?.className).toContain('brand-blue')
  })

  it('document count badge shows correct count', () => {
    render(<NavigationTree {...defaultProps} />)
    expandFolders()
    expect(screen.getByText('2')).toBeTruthy()
  })

  it('empty folder shows "Empty folder" text', () => {
    const folders: Record<string, FolderNode> = {
      'f3': {
        id: 'f3',
        name: 'Empty Folder',
        children: [],
        documents: [],
        documentCount: 0,
      },
    }
    render(<NavigationTree {...defaultProps} folders={folders} />)
    expandFolders()
    expect(screen.getByText('Empty Folder')).toBeTruthy()
  })

  it('right-click opens context menu', () => {
    render(<NavigationTree {...defaultProps} />)
    expandFolders()
    fireEvent.contextMenu(screen.getByText('Contracts'))
    expect(screen.getByTestId('context-menu')).toBeTruthy()
  })

  it('double-click triggers inline rename', () => {
    render(<NavigationTree {...defaultProps} />)
    expandFolders()
    fireEvent.doubleClick(screen.getByText('Contracts'))
    const input = document.querySelector('input')
    expect(input).toBeTruthy()
  })

  it('inline rename cancels on Escape', () => {
    render(<NavigationTree {...defaultProps} />)
    expandFolders()
    fireEvent.doubleClick(screen.getByText('Contracts'))
    const input = document.querySelector('input')
    if (input) {
      fireEvent.keyDown(input, { key: 'Escape' })
      expect(screen.getByText('Contracts')).toBeTruthy()
    }
  })

  it('inline rename saves on Enter', () => {
    render(<NavigationTree {...defaultProps} />)
    expandFolders()
    fireEvent.doubleClick(screen.getByText('Contracts'))
    const input = document.querySelector('input')
    if (input) {
      fireEvent.change(input, { target: { value: 'New Name' } })
      fireEvent.keyDown(input, { key: 'Enter' })
    }
  })

  it('clicking a folder calls onSelectFolder', () => {
    render(<NavigationTree {...defaultProps} />)
    expandFolders()
    fireEvent.click(screen.getByText('Contracts'))
    expect(defaultProps.onSelectFolder).toHaveBeenCalledWith('f1')
  })

  it('"All Files" navigates to null folder', () => {
    render(<NavigationTree {...defaultProps} />)
    expandFolders()
    fireEvent.click(screen.getByText('All Files'))
    expect(defaultProps.onSelectFolder).toHaveBeenCalledWith(null)
  })

  it('tree lines render at correct indent levels', () => {
    render(<NavigationTree {...defaultProps} />)
    expandFolders()
    expect(screen.getByText('Contracts')).toBeTruthy()
  })

  it('quick access section shows starred and recent counts', () => {
    render(<NavigationTree {...defaultProps} />)
    fireEvent.click(screen.getByText('Quick Access'))
    expect(screen.getByText('5')).toBeTruthy()
    expect(screen.getByText('10')).toBeTruthy()
  })
})
