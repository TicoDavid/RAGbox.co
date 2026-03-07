/**
 * Sarah — S-P0-02: InsightCard tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

const mockDismiss = jest.fn()

jest.mock('@/stores/mercuryStore', () => ({
  useMercuryStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ dismissInsight: mockDismiss }),
}))

jest.mock('lucide-react', () => ({
  Lightbulb: (props: React.ComponentProps<'svg'>) => <svg data-testid="icon-lightbulb" {...props} />,
  X: (props: React.ComponentProps<'svg'>) => <svg data-testid="icon-x" {...props} />,
}))

import { InsightCard } from '../InsightCard'

describe('InsightCard', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders insight content', () => {
    render(<InsightCard id="ins-1" content="A pattern was detected" />)
    expect(screen.getByText('A pattern was detected')).toBeTruthy()
  })

  it('renders "Evelyn noticed:" label', () => {
    render(<InsightCard id="ins-1" content="test" />)
    expect(screen.getByText('Evelyn noticed:')).toBeTruthy()
  })

  it('calls dismissInsight with id on dismiss click', () => {
    render(<InsightCard id="ins-42" content="test" />)
    fireEvent.click(screen.getByLabelText('Dismiss insight'))
    expect(mockDismiss).toHaveBeenCalledWith('ins-42')
  })
})
