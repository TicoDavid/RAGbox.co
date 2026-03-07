/**
 * Sarah — S-P0-02: StudioButton tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return { Hammer: icon('hammer') }
})

jest.mock('../TemplateSelector', () => {
  return ({ onClose }: { onClose: () => void }) => (
    <div data-testid="template-selector"><button onClick={onClose}>Close</button></div>
  )
})

import StudioButton from '../StudioButton'

describe('StudioButton', () => {
  it('renders "Studio" text', () => {
    render(<StudioButton responseText="test" />)
    expect(screen.getByText('Studio')).toBeTruthy()
  })

  it('renders hammer icon', () => {
    render(<StudioButton responseText="test" />)
    expect(screen.getByTestId('icon-hammer')).toBeTruthy()
  })

  it('opens TemplateSelector on click', () => {
    render(<StudioButton responseText="test" />)
    fireEvent.click(screen.getByText('Studio'))
    expect(screen.getByTestId('template-selector')).toBeTruthy()
  })

  it('has correct title', () => {
    render(<StudioButton responseText="test" />)
    expect(screen.getByTitle('Generate document in Sovereign Studio')).toBeTruthy()
  })
})
