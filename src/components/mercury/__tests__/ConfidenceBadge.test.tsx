/**
 * Sarah — S-P0-02: ConfidenceBadge (mercury/) tests
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import ConfidenceBadge from '../ConfidenceBadge'

describe('ConfidenceBadge (mercury)', () => {
  it('renders percentage', () => {
    render(<ConfidenceBadge confidence={0.92} />)
    expect(screen.getByText('92%')).toBeTruthy()
  })

  it('uses green color for high confidence (>=0.85)', () => {
    const { container } = render(<ConfidenceBadge confidence={0.90} />)
    const span = container.firstChild as HTMLElement
    expect(span.style.color).toBe('rgb(34, 197, 94)')
  })

  it('uses amber color for medium confidence (0.70-0.84)', () => {
    const { container } = render(<ConfidenceBadge confidence={0.75} />)
    const span = container.firstChild as HTMLElement
    expect(span.style.color).toBe('rgb(245, 158, 11)')
  })

  it('uses red color for low confidence (<0.70)', () => {
    const { container } = render(<ConfidenceBadge confidence={0.50} />)
    const span = container.firstChild as HTMLElement
    expect(span.style.color).toBe('rgb(239, 68, 68)')
  })
})
