/**
 * Sarah — S-P0-02: MatrixRain tests
 */

import React from 'react'
import { render, screen } from '@testing-library/react'

// Mock canvas and requestAnimationFrame
HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  fillStyle: '',
  font: '',
  fillRect: jest.fn(),
  fillText: jest.fn(),
})) as never

import { MatrixRain } from '../MatrixRain'

describe('MatrixRain', () => {
  it('renders overlay text', () => {
    render(<MatrixRain />)
    expect(screen.getByText('Generating document...')).toBeTruthy()
  })

  it('renders studio AI label', () => {
    render(<MatrixRain />)
    expect(screen.getByText('Sovereign Studio AI')).toBeTruthy()
  })

  it('renders a canvas element', () => {
    const { container } = render(<MatrixRain />)
    expect(container.querySelector('canvas')).toBeTruthy()
  })
})
