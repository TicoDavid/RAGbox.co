/**
 * Sarah — S-P0-02: ConfidenceBadge tests
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { ConfidenceBadge } from '../ConfidenceBadge'

describe('ConfidenceBadge', () => {
  it('renders percentage from decimal confidence', () => {
    render(<ConfidenceBadge confidence={0.92} />)
    expect(screen.getByText('92%')).toBeTruthy()
  })

  it('rounds to nearest integer', () => {
    render(<ConfidenceBadge confidence={0.876} />)
    expect(screen.getByText('88%')).toBeTruthy()
  })

  it('uses success color for confidence >= 0.85', () => {
    const { container } = render(<ConfidenceBadge confidence={0.90} />)
    const span = container.firstChild as HTMLElement
    expect(span.className).toContain('success')
  })

  it('uses warning color for confidence 0.70–0.84', () => {
    const { container } = render(<ConfidenceBadge confidence={0.75} />)
    const span = container.firstChild as HTMLElement
    expect(span.className).toContain('warning')
  })

  it('uses danger color for confidence < 0.70', () => {
    const { container } = render(<ConfidenceBadge confidence={0.50} />)
    const span = container.firstChild as HTMLElement
    expect(span.className).toContain('danger')
  })

  it('renders 0% for zero confidence', () => {
    render(<ConfidenceBadge confidence={0} />)
    expect(screen.getByText('0%')).toBeTruthy()
  })

  it('renders 100% for perfect confidence', () => {
    render(<ConfidenceBadge confidence={1.0} />)
    expect(screen.getByText('100%')).toBeTruthy()
  })
})
