/**
 * Sarah — S-P0-02: TableOfContents tests
 */

import React from 'react'
import { render, screen } from '@testing-library/react'

// Mock IntersectionObserver (not available in jsdom)
beforeAll(() => {
  global.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof IntersectionObserver
})

import { TableOfContents } from '../TableOfContents'

describe('TableOfContents', () => {
  it('returns null for fewer than 3 entries', () => {
    const { container } = render(
      <TableOfContents entries={[{ id: 'a', text: 'A', level: 2 }, { id: 'b', text: 'B', level: 2 }]} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders entries when >= 3', () => {
    const entries = [
      { id: 'intro', text: 'Introduction', level: 2 },
      { id: 'setup', text: 'Setup', level: 2 },
      { id: 'api', text: 'API', level: 2 },
    ]
    render(<TableOfContents entries={entries} />)
    expect(screen.getByText('On this page')).toBeTruthy()
    expect(screen.getByText('Introduction')).toBeTruthy()
    expect(screen.getByText('Setup')).toBeTruthy()
    expect(screen.getByText('API')).toBeTruthy()
  })

  it('renders links with correct hrefs', () => {
    const entries = [
      { id: 'intro', text: 'Intro', level: 2 },
      { id: 'setup', text: 'Setup', level: 2 },
      { id: 'api', text: 'API', level: 2 },
    ]
    render(<TableOfContents entries={entries} />)
    expect(screen.getByText('Intro').closest('a')?.getAttribute('href')).toBe('#intro')
  })
})
