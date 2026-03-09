/**
 * Sarah — EPIC-032 T1: VaultBreadcrumb tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('framer-motion', () => ({
  motion: {
    button: React.forwardRef(
      ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLButtonElement>) => (
        <button ref={ref} {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}>{children}</button>
      ),
    ),
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
    Home: icon('home'),
    ChevronRight: icon('chevron-right'),
    MoreHorizontal: icon('more-horizontal'),
  }
})

import { VaultBreadcrumb, BreadcrumbSegment } from '../VaultBreadcrumb'

describe('VaultBreadcrumb', () => {
  const mockNavigate = jest.fn()

  beforeEach(() => jest.clearAllMocks())

  it('renders root "Vault" segment when at root path', () => {
    render(<VaultBreadcrumb segments={[]} onNavigate={mockNavigate} />)
    expect(screen.getByText('Vault')).toBeTruthy()
    expect(screen.getByRole('navigation', { name: 'Vault breadcrumb' })).toBeTruthy()
  })

  it('renders full path: Vault > Contracts > 2026 > Q1', () => {
    const segments: BreadcrumbSegment[] = [
      { id: 'contracts', label: 'Contracts' },
      { id: '2026', label: '2026' },
      { id: 'q1', label: 'Q1' },
    ]
    render(<VaultBreadcrumb segments={segments} onNavigate={mockNavigate} />)
    expect(screen.getByText('Vault')).toBeTruthy()
    expect(screen.getByText('Contracts')).toBeTruthy()
    expect(screen.getByText('2026')).toBeTruthy()
    expect(screen.getByText('Q1')).toBeTruthy()
  })

  it('navigates to folder on segment click', () => {
    const segments: BreadcrumbSegment[] = [
      { id: 'contracts', label: 'Contracts' },
      { id: '2026', label: '2026' },
    ]
    render(<VaultBreadcrumb segments={segments} onNavigate={mockNavigate} />)
    fireEvent.click(screen.getByText('Contracts'))
    expect(mockNavigate).toHaveBeenCalledWith(['contracts'])
  })

  it('root segment navigates to empty path', () => {
    const segments: BreadcrumbSegment[] = [
      { id: 'contracts', label: 'Contracts' },
    ]
    render(<VaultBreadcrumb segments={segments} onNavigate={mockNavigate} />)
    fireEvent.click(screen.getByText('Vault'))
    expect(mockNavigate).toHaveBeenCalledWith([])
  })

  it('truncates long paths (> 4 segments) with ellipsis', () => {
    const segments: BreadcrumbSegment[] = [
      { id: 'a', label: 'Level A' },
      { id: 'b', label: 'Level B' },
      { id: 'c', label: 'Level C' },
      { id: 'd', label: 'Level D' },
      { id: 'e', label: 'Level E' },
    ]
    render(<VaultBreadcrumb segments={segments} onNavigate={mockNavigate} />)
    // Ellipsis button should appear
    expect(screen.getByLabelText('Show hidden path segments')).toBeTruthy()
    // Last 3 (maxVisible - 1 = 3) segments visible
    expect(screen.getByText('Level C')).toBeTruthy()
    expect(screen.getByText('Level D')).toBeTruthy()
    expect(screen.getByText('Level E')).toBeTruthy()
  })

  it('ellipsis dropdown shows hidden segments', () => {
    const segments: BreadcrumbSegment[] = [
      { id: 'a', label: 'Level A' },
      { id: 'b', label: 'Level B' },
      { id: 'c', label: 'Level C' },
      { id: 'd', label: 'Level D' },
      { id: 'e', label: 'Level E' },
    ]
    render(<VaultBreadcrumb segments={segments} onNavigate={mockNavigate} />)
    fireEvent.click(screen.getByLabelText('Show hidden path segments'))
    // Hidden segments appear in dropdown
    expect(screen.getByText('Level A')).toBeTruthy()
    expect(screen.getByText('Level B')).toBeTruthy()
  })

  it('active (last) segment is not clickable', () => {
    const segments: BreadcrumbSegment[] = [
      { id: 'contracts', label: 'Contracts' },
      { id: '2026', label: '2026' },
    ]
    render(<VaultBreadcrumb segments={segments} onNavigate={mockNavigate} />)
    const lastSegment = screen.getByText('2026')
    fireEvent.click(lastSegment)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('last segment has aria-current="page"', () => {
    const segments: BreadcrumbSegment[] = [
      { id: 'contracts', label: 'Contracts' },
    ]
    render(<VaultBreadcrumb segments={segments} onNavigate={mockNavigate} />)
    const lastButton = screen.getByText('Contracts').closest('button')
    expect(lastButton?.getAttribute('aria-current')).toBe('page')
  })

  it('updates when currentPath changes', () => {
    const { rerender } = render(
      <VaultBreadcrumb segments={[{ id: 'a', label: 'Folder A' }]} onNavigate={mockNavigate} />,
    )
    expect(screen.getByText('Folder A')).toBeTruthy()

    rerender(
      <VaultBreadcrumb segments={[{ id: 'b', label: 'Folder B' }]} onNavigate={mockNavigate} />,
    )
    expect(screen.getByText('Folder B')).toBeTruthy()
  })
})
