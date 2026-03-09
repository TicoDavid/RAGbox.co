/**
 * Sarah — EPIC-032 T2: VaultSearchFilters tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import type { VaultFilters } from '@/stores/vaultStore'
import type { VaultItem } from '@/types/ragbox'

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
  return { Inbox: icon('inbox') }
})

import { VaultSearchFilters, FilterEmptyState, filterDocuments, highlightMatch, getDocType } from '../VaultSearchFilters'

const DEFAULT_FILTERS: VaultFilters = {
  types: [],
  dateRange: null,
  sizeRange: null,
  status: [],
}

describe('VaultSearchFilters', () => {
  const mockSetFilter = jest.fn()
  const mockClearFilters = jest.fn()

  const renderFilters = (overrides: Partial<{
    filters: VaultFilters
    resultCount: number
    searchQuery: string
  }> = {}) =>
    render(
      <VaultSearchFilters
        filters={overrides.filters ?? DEFAULT_FILTERS}
        onSetFilter={mockSetFilter}
        onClearFilters={mockClearFilters}
        resultCount={overrides.resultCount ?? 10}
        searchQuery={overrides.searchQuery ?? ''}
      />,
    )

  beforeEach(() => jest.clearAllMocks())

  it('renders filter chip categories (type, date, size, status)', () => {
    renderFilters()
    expect(screen.getByText('PDF')).toBeTruthy()
    expect(screen.getByText('Doc')).toBeTruthy()
    expect(screen.getByText('Image')).toBeTruthy()
    expect(screen.getByText('Audio')).toBeTruthy()
    expect(screen.getByText('Today')).toBeTruthy()
    expect(screen.getByText('Week')).toBeTruthy()
    expect(screen.getByText('Month')).toBeTruthy()
    expect(screen.getByText('<1MB')).toBeTruthy()
    expect(screen.getByText('1-10MB')).toBeTruthy()
    expect(screen.getByText('10-50MB')).toBeTruthy()
    expect(screen.getByText('Indexed')).toBeTruthy()
    expect(screen.getByText('Failed')).toBeTruthy()
  })

  it('toggles type filter chip on click', () => {
    renderFilters()
    fireEvent.click(screen.getByText('PDF'))
    expect(mockSetFilter).toHaveBeenCalledWith('types', ['pdf'])
  })

  it('multiple filters selectable simultaneously', () => {
    const filters: VaultFilters = { ...DEFAULT_FILTERS, types: ['pdf'] }
    renderFilters({ filters })
    fireEvent.click(screen.getByText('Doc'))
    expect(mockSetFilter).toHaveBeenCalledWith('types', ['pdf', 'doc'])
  })

  it('"Clear all" resets all active filters', () => {
    const filters: VaultFilters = { ...DEFAULT_FILTERS, types: ['pdf'] }
    renderFilters({ filters })
    fireEvent.click(screen.getByText('Clear all filters'))
    expect(mockClearFilters).toHaveBeenCalled()
  })

  it('result count displays correctly', () => {
    renderFilters({ resultCount: 42, filters: { ...DEFAULT_FILTERS, types: ['pdf'] } })
    expect(screen.getByText('42 documents found')).toBeTruthy()
  })

  it('result count singular', () => {
    renderFilters({ resultCount: 1, filters: { ...DEFAULT_FILTERS, types: ['pdf'] } })
    expect(screen.getByText('1 document found')).toBeTruthy()
  })

  it('removing a single filter chip works', () => {
    const filters: VaultFilters = { ...DEFAULT_FILTERS, types: ['pdf', 'doc'] }
    renderFilters({ filters })
    fireEvent.click(screen.getByText('PDF'))
    expect(mockSetFilter).toHaveBeenCalledWith('types', ['doc'])
  })

  it('toggles date filter as single select', () => {
    renderFilters()
    fireEvent.click(screen.getByText('Today'))
    expect(mockSetFilter).toHaveBeenCalledWith('dateRange', 'today')
  })

  it('clicking active date filter deselects it', () => {
    const filters: VaultFilters = { ...DEFAULT_FILTERS, dateRange: 'today' }
    renderFilters({ filters })
    fireEvent.click(screen.getByText('Today'))
    expect(mockSetFilter).toHaveBeenCalledWith('dateRange', null)
  })

  it('toggles size filter as single select', () => {
    renderFilters()
    fireEvent.click(screen.getByText('<1MB'))
    expect(mockSetFilter).toHaveBeenCalledWith('sizeRange', 'small')
  })
})

describe('FilterEmptyState', () => {
  it('renders empty state message', () => {
    render(<FilterEmptyState onClear={jest.fn()} />)
    expect(screen.getByText('No documents match your filters')).toBeTruthy()
  })

  it('clear button calls onClear', () => {
    const mockClear = jest.fn()
    render(<FilterEmptyState onClear={mockClear} />)
    fireEvent.click(screen.getByText('clear all filters'))
    expect(mockClear).toHaveBeenCalled()
  })
})

describe('filterDocuments', () => {
  const makeDocs = (overrides: Partial<VaultItem>[] = []): Record<string, VaultItem> => {
    const docs: Record<string, VaultItem> = {}
    const defaults: VaultItem = {
      id: '1',
      name: 'test.pdf',
      originalName: 'test.pdf',
      type: 'document',
      mimeType: 'application/pdf',
      size: 500000,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'Indexed',
      isPrivileged: false,
      isStarred: false,
      securityTier: 0,
      deletionStatus: 'Active',
    }
    overrides.forEach((o, i) => {
      const doc = { ...defaults, id: `doc-${i}`, ...o }
      docs[doc.id] = doc
    })
    return docs
  }

  it('applies type filter correctly', () => {
    const docs = makeDocs([
      { name: 'a.pdf', mimeType: 'application/pdf' },
      { name: 'b.png', mimeType: 'image/png' },
    ])
    const result = filterDocuments(docs, { ...DEFAULT_FILTERS, types: ['pdf'] }, '')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('a.pdf')
  })

  it('applies date filter correctly', () => {
    const docs = makeDocs([
      { name: 'new.pdf', createdAt: new Date() },
      { name: 'old.pdf', createdAt: new Date('2020-01-01') },
    ])
    const result = filterDocuments(docs, { ...DEFAULT_FILTERS, dateRange: 'week' }, '')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('new.pdf')
  })

  it('applies size filter correctly', () => {
    const docs = makeDocs([
      { name: 'small.pdf', size: 100 },
      { name: 'medium.pdf', size: 5 * 1024 * 1024 },
    ])
    const result = filterDocuments(docs, { ...DEFAULT_FILTERS, sizeRange: 'small' }, '')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('small.pdf')
  })

  it('combines multiple filters', () => {
    const docs = makeDocs([
      { name: 'a.pdf', mimeType: 'application/pdf', size: 100, status: 'Indexed' },
      { name: 'b.pdf', mimeType: 'application/pdf', size: 5 * 1024 * 1024, status: 'Indexed' },
      { name: 'c.png', mimeType: 'image/png', size: 100, status: 'Indexed' },
    ])
    const filters: VaultFilters = { types: ['pdf'], dateRange: null, sizeRange: 'small', status: [] }
    const result = filterDocuments(docs, filters, '')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('a.pdf')
  })

  it('search narrows results by name', () => {
    const docs = makeDocs([
      { name: 'contract.pdf' },
      { name: 'memo.pdf' },
    ])
    const result = filterDocuments(docs, DEFAULT_FILTERS, 'contract')
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('contract.pdf')
  })
})

describe('highlightMatch', () => {
  it('returns filename unchanged when no query', () => {
    expect(highlightMatch('test.pdf', '')).toBe('test.pdf')
  })

  it('highlights matching text with <mark>', () => {
    const result = highlightMatch('contract.pdf', 'tract')
    const { container } = render(<>{result}</>)
    expect(container.querySelector('mark')?.textContent).toBe('tract')
  })
})

describe('getDocType', () => {
  it('classifies PDF', () => expect(getDocType('application/pdf')).toBe('pdf'))
  it('classifies Word doc', () => expect(getDocType('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('doc'))
  it('classifies image', () => expect(getDocType('image/png')).toBe('image'))
  it('classifies audio', () => expect(getDocType('audio/mp3')).toBe('audio'))
  it('classifies plain text', () => expect(getDocType('text/plain')).toBe('doc'))
  it('returns other for unknown', () => expect(getDocType('application/zip')).toBe('other'))
  it('returns other for undefined', () => expect(getDocType(undefined)).toBe('other'))
})
