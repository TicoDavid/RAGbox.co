/**
 * Sarah — S-P0-02: SourceHighlight tests
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import SourceHighlight from '../SourceHighlight'

describe('SourceHighlight', () => {
  it('renders plain text when not highlighted', () => {
    render(<SourceHighlight text="plain text" isHighlighted={false} />)
    expect(screen.getByText('plain text')).toBeTruthy()
  })

  it('renders highlighted text with citation index', () => {
    render(<SourceHighlight text="cited text" isHighlighted={true} citationIndex={2} />)
    expect(screen.getByText('cited text')).toBeTruthy()
    expect(screen.getByText('[2]')).toBeTruthy()
  })

  it('does not show citation badge when citationIndex is not provided', () => {
    render(<SourceHighlight text="highlighted" isHighlighted={true} />)
    expect(screen.getByText('highlighted')).toBeTruthy()
    expect(screen.queryByText(/\[/)).toBeNull()
  })

  it('applies highlight styling when isHighlighted is true', () => {
    const { container } = render(<SourceHighlight text="test" isHighlighted={true} />)
    const span = container.firstChild as HTMLElement
    expect(span.style.borderLeft).toContain('2px solid')
  })
})
