/**
 * Sarah — S-P0-02: FeedbackButton tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

const mockSubmit = jest.fn(() => Promise.resolve())

jest.mock('@/stores/feedbackStore', () => ({
  useFeedbackStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ submitFeedback: mockSubmit, isSubmitting: false }),
}))

jest.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLDivElement>) => <div ref={ref} {...props}>{children}</div>),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}))

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    MessageSquarePlus: icon('msg-plus'),
    X: icon('x'),
    Send: icon('send'),
    Loader2: icon('loader'),
  }
})

import { FeedbackButton } from '../FeedbackButton'

describe('FeedbackButton', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders the floating trigger button', () => {
    render(<FeedbackButton />)
    expect(screen.getByTitle('Send feedback')).toBeTruthy()
  })

  it('opens form modal on click', () => {
    render(<FeedbackButton />)
    fireEvent.click(screen.getByTitle('Send feedback'))
    expect(screen.getByText('Beta Feedback')).toBeTruthy()
  })

  it('renders type options', () => {
    render(<FeedbackButton />)
    fireEvent.click(screen.getByTitle('Send feedback'))
    expect(screen.getByText('Bug')).toBeTruthy()
    expect(screen.getByText('Feature')).toBeTruthy()
    expect(screen.getByText('Question')).toBeTruthy()
    expect(screen.getByText('Observation')).toBeTruthy()
  })

  it('renders severity options', () => {
    render(<FeedbackButton />)
    fireEvent.click(screen.getByTitle('Send feedback'))
    expect(screen.getByText('Critical')).toBeTruthy()
    expect(screen.getByText('High')).toBeTruthy()
    expect(screen.getByText('Medium')).toBeTruthy()
    expect(screen.getByText('Low')).toBeTruthy()
  })

  it('renders module options', () => {
    render(<FeedbackButton />)
    fireEvent.click(screen.getByTitle('Send feedback'))
    expect(screen.getByText('Vault')).toBeTruthy()
    expect(screen.getByText('Mercury')).toBeTruthy()
    expect(screen.getByText('Studio')).toBeTruthy()
  })

  it('disables submit when description is empty', () => {
    render(<FeedbackButton />)
    fireEvent.click(screen.getByTitle('Send feedback'))
    const submit = screen.getByText('Submit Feedback').closest('button')
    expect(submit?.disabled).toBe(true)
  })
})
