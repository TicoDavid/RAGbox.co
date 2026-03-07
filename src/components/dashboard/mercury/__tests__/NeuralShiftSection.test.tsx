/**
 * Sarah — S-P0-02: NeuralShiftSection tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return { ChevronRight: icon('chevron-right'), Pencil: icon('pencil'), RotateCcw: icon('rotate'), Save: icon('save') }
})

jest.mock('sonner', () => ({ toast: { success: jest.fn() } }))

jest.mock('@/lib/personas', () => ({
  PERSONAS: [
    { id: 'analyst', label: 'Analyst', role: 'Data analysis', prompt: 'You are an analyst.' },
    { id: 'counsel', label: 'Counsel', role: 'Legal advisor', prompt: 'You are a counsel.' },
  ],
}))

import { NeuralShiftSection } from '../NeuralShiftSection'

describe('NeuralShiftSection', () => {
  it('renders heading', () => {
    render(<NeuralShiftSection />)
    expect(screen.getByText('Neural Shift Personas')).toBeTruthy()
  })

  it('renders persona labels', () => {
    render(<NeuralShiftSection />)
    expect(screen.getByText('Analyst')).toBeTruthy()
    expect(screen.getByText('Counsel')).toBeTruthy()
  })

  it('renders persona roles', () => {
    render(<NeuralShiftSection />)
    expect(screen.getByText('Data analysis')).toBeTruthy()
    expect(screen.getByText('Legal advisor')).toBeTruthy()
  })

  it('expands persona on click to show prompt', () => {
    render(<NeuralShiftSection />)
    fireEvent.click(screen.getByText('Analyst'))
    expect(screen.getByDisplayValue('You are an analyst.')).toBeTruthy()
  })

  it('shows Edit button when expanded', () => {
    render(<NeuralShiftSection />)
    fireEvent.click(screen.getByText('Analyst'))
    expect(screen.getByText('Edit')).toBeTruthy()
  })
})
