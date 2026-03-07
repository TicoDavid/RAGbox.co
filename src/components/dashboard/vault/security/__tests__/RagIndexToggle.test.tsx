/**
 * Sarah — S-P0-02: RagIndexToggle tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLDivElement>) => <div ref={ref} {...props}>{children}</div>),
  },
}))

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return { Brain: icon('brain'), BrainCog: icon('braincog'), ShieldAlert: icon('shieldalert') }
})

import { RagIndexToggle } from '../RagIndexToggle'

describe('RagIndexToggle', () => {
  const onChange = jest.fn()

  beforeEach(() => jest.clearAllMocks())

  it('shows "Indexed for RAG" when enabled', () => {
    render(<RagIndexToggle enabled={true} onChange={onChange} />)
    expect(screen.getByText('Indexed for RAG')).toBeTruthy()
    expect(screen.getByText('AI can see and cite this document in responses.')).toBeTruthy()
  })

  it('shows "RAG Disabled" when disabled', () => {
    render(<RagIndexToggle enabled={false} onChange={onChange} />)
    expect(screen.getByText('RAG Disabled')).toBeTruthy()
    expect(screen.getByText('Document is stored but AI cannot access or cite it.')).toBeTruthy()
  })

  it('shows warning when disabled', () => {
    render(<RagIndexToggle enabled={false} onChange={onChange} />)
    expect(screen.getByText('Vector Database Excluded')).toBeTruthy()
  })

  it('hides warning when enabled', () => {
    render(<RagIndexToggle enabled={true} onChange={onChange} />)
    expect(screen.queryByText('Vector Database Excluded')).toBeNull()
  })

  it('calls onChange with toggled value on click', () => {
    render(<RagIndexToggle enabled={true} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button'))
    expect(onChange).toHaveBeenCalledWith(false)
  })
})
