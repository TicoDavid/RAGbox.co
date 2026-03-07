/**
 * Sarah — S-P0-02: DuplicateFileDialog tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

const mockResolve = jest.fn()

let mockConflict: Record<string, unknown> | null = null

jest.mock('@/stores/vaultStore', () => ({
  useVaultStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ duplicateConflict: mockConflict }),
}))

jest.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLDivElement>) => <div ref={ref} {...props}>{children}</div>),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}))

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    AlertTriangle: icon('alert'),
    Copy: icon('copy'),
    RefreshCw: icon('refresh'),
    X: icon('x'),
    SkipForward: icon('skip'),
    RefreshCcw: icon('refreshcc'),
  }
})

import { DuplicateFileDialog } from '../DuplicateFileDialog'

describe('DuplicateFileDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockConflict = null
  })

  it('returns null when no conflict', () => {
    const { container } = render(<DuplicateFileDialog />)
    expect(container.innerHTML).toBe('')
  })

  it('renders dialog with file name when conflict exists', () => {
    mockConflict = {
      fileName: 'report.pdf',
      fileSize: 1024000,
      remainingDuplicates: 0,
      resolve: mockResolve,
    }
    render(<DuplicateFileDialog />)
    expect(screen.getByText('Duplicate File Detected')).toBeTruthy()
    expect(screen.getByText('report.pdf')).toBeTruthy()
  })

  it('shows file size formatted', () => {
    mockConflict = {
      fileName: 'doc.pdf',
      fileSize: 2097152,
      remainingDuplicates: 0,
      resolve: mockResolve,
    }
    render(<DuplicateFileDialog />)
    expect(screen.getByText('2.0 MB')).toBeTruthy()
  })

  it('renders Replace, Keep Both, Skip actions', () => {
    mockConflict = {
      fileName: 'doc.pdf',
      fileSize: 1024,
      remainingDuplicates: 0,
      resolve: mockResolve,
    }
    render(<DuplicateFileDialog />)
    expect(screen.getByText('Replace')).toBeTruthy()
    expect(screen.getByText('Keep Both')).toBeTruthy()
    expect(screen.getByText('Skip This File')).toBeTruthy()
  })

  it('calls resolve with replace on Replace click', () => {
    mockConflict = {
      fileName: 'doc.pdf',
      fileSize: 1024,
      remainingDuplicates: 0,
      resolve: mockResolve,
    }
    render(<DuplicateFileDialog />)
    fireEvent.click(screen.getByText('Replace'))
    expect(mockResolve).toHaveBeenCalledWith('replace')
  })

  it('calls resolve with keep-both on Keep Both click', () => {
    mockConflict = {
      fileName: 'doc.pdf',
      fileSize: 1024,
      remainingDuplicates: 0,
      resolve: mockResolve,
    }
    render(<DuplicateFileDialog />)
    fireEvent.click(screen.getByText('Keep Both'))
    expect(mockResolve).toHaveBeenCalledWith('keep-both')
  })

  it('shows bulk actions when remaining duplicates > 0', () => {
    mockConflict = {
      fileName: 'doc.pdf',
      fileSize: 1024,
      remainingDuplicates: 3,
      resolve: mockResolve,
    }
    render(<DuplicateFileDialog />)
    expect(screen.getByText(/3 more duplicates remaining/)).toBeTruthy()
    expect(screen.getByText('Skip All Duplicates')).toBeTruthy()
    expect(screen.getByText('Replace All')).toBeTruthy()
  })
})
