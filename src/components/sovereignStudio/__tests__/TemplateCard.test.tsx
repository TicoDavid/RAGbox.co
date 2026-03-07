/**
 * Sarah — S-P0-02: TemplateCard tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return { FileText: icon('file-text'), Calendar: icon('calendar'), Tag: icon('tag') }
})

import TemplateCard from '../TemplateCard'

const mockTemplate = {
  name: 'Compliance Report',
  category: 'legal',
  fields: [{ name: 'title' }, { name: 'date' }],
  sections: [{ name: 'Summary' }, { name: 'Findings' }],
  confidence: 0.85,
}

describe('TemplateCard', () => {
  it('renders template name', () => {
    render(<TemplateCard template={mockTemplate as never} onSelect={jest.fn()} />)
    expect(screen.getByText('Compliance Report')).toBeTruthy()
  })

  it('renders category', () => {
    render(<TemplateCard template={mockTemplate as never} onSelect={jest.fn()} />)
    expect(screen.getByText('legal')).toBeTruthy()
  })

  it('shows field count', () => {
    render(<TemplateCard template={mockTemplate as never} onSelect={jest.fn()} />)
    expect(screen.getByText('2 fields')).toBeTruthy()
  })

  it('shows section count', () => {
    render(<TemplateCard template={mockTemplate as never} onSelect={jest.fn()} />)
    expect(screen.getByText('2 sections')).toBeTruthy()
  })

  it('calls onSelect when clicked', () => {
    const onSelect = jest.fn()
    render(<TemplateCard template={mockTemplate as never} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Compliance Report'))
    expect(onSelect).toHaveBeenCalledWith(mockTemplate)
  })

  it('shows low confidence warning', () => {
    const lowConf = { ...mockTemplate, confidence: 0.3 }
    render(<TemplateCard template={lowConf as never} onSelect={jest.fn()} />)
    expect(screen.getByText(/Low confidence/)).toBeTruthy()
  })

  it('does not show warning for high confidence', () => {
    render(<TemplateCard template={mockTemplate as never} onSelect={jest.fn()} />)
    expect(screen.queryByText(/Low confidence/)).toBeNull()
  })
})
