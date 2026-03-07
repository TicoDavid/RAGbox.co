/**
 * Sarah — S-P0-02: FeedbackModal tests
 *
 * Covers: render/hide, category selection, message input,
 * submit disabled when short, submit calls store.
 */

import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'

// ── Mocks ──────────────────────────────────────────────────────

const mockSubmitFeedback = jest.fn(() => Promise.resolve())

jest.mock('@/stores/feedbackStore', () => ({
  useFeedbackStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      submitFeedback: mockSubmitFeedback,
      isSubmitting: false,
    }),
}))

jest.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLDivElement>) => <div ref={ref} {...props}>{children}</div>),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}))

jest.mock('lucide-react', () => ({
  X: (props: React.ComponentProps<'svg'>) => <svg data-testid="icon-x" {...props} />,
  Camera: (props: React.ComponentProps<'svg'>) => <svg data-testid="icon-camera" {...props} />,
  Loader2: (props: React.ComponentProps<'svg'>) => <svg data-testid="icon-loader" {...props} />,
  Bug: (props: React.ComponentProps<'svg'>) => <svg data-testid="icon-bug" {...props} />,
  Lightbulb: (props: React.ComponentProps<'svg'>) => <svg data-testid="icon-lightbulb" {...props} />,
  MessageCircle: (props: React.ComponentProps<'svg'>) => <svg data-testid="icon-message" {...props} />,
}))

import { FeedbackModal } from '../FeedbackModal'

describe('FeedbackModal', () => {
  const onClose = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns null when isOpen is false', () => {
    const { container } = render(<FeedbackModal isOpen={false} onClose={onClose} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders modal when isOpen is true', () => {
    render(<FeedbackModal isOpen={true} onClose={onClose} />)
    expect(screen.getByRole('heading', { name: 'Send Feedback' })).toBeTruthy()
  })

  it('renders 3 category buttons', () => {
    render(<FeedbackModal isOpen={true} onClose={onClose} />)
    expect(screen.getByText('Bug')).toBeTruthy()
    expect(screen.getByText('Feature Request')).toBeTruthy()
    expect(screen.getByText('General')).toBeTruthy()
  })

  it('renders message textarea', () => {
    render(<FeedbackModal isOpen={true} onClose={onClose} />)
    expect(screen.getByPlaceholderText("Tell us what's on your mind...")).toBeTruthy()
  })

  it('shows 0/2000 character count initially', () => {
    render(<FeedbackModal isOpen={true} onClose={onClose} />)
    expect(screen.getByText('0/2000')).toBeTruthy()
  })

  it('updates character count as user types', () => {
    render(<FeedbackModal isOpen={true} onClose={onClose} />)
    const textarea = screen.getByPlaceholderText("Tell us what's on your mind...")
    fireEvent.change(textarea, { target: { value: 'Hello world' } })
    expect(screen.getByText('11/2000')).toBeTruthy()
  })

  it('disables Send button when message is too short', () => {
    render(<FeedbackModal isOpen={true} onClose={onClose} />)
    const sendBtn = screen.getByRole('button', { name: 'Send Feedback' })
    expect(sendBtn).toBeDisabled()
  })

  it('enables Send button when message >= 10 chars', () => {
    render(<FeedbackModal isOpen={true} onClose={onClose} />)
    const textarea = screen.getByPlaceholderText("Tell us what's on your mind...")
    fireEvent.change(textarea, { target: { value: 'This is a valid feedback message' } })
    const sendBtn = screen.getByRole('button', { name: 'Send Feedback' })
    expect(sendBtn).not.toBeDisabled()
  })

  it('calls submitFeedback on submit', async () => {
    render(<FeedbackModal isOpen={true} onClose={onClose} />)
    const textarea = screen.getByPlaceholderText("Tell us what's on your mind...")
    fireEvent.change(textarea, { target: { value: 'This is a valid feedback message' } })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send Feedback' }))
    })

    expect(mockSubmitFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'Bug',
        description: 'This is a valid feedback message',
      })
    )
  })

  it('calls onClose when Cancel is clicked', () => {
    render(<FeedbackModal isOpen={true} onClose={onClose} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalled()
  })

  it('renders attach screenshot button', () => {
    render(<FeedbackModal isOpen={true} onClose={onClose} />)
    expect(screen.getByText('Attach screenshot (optional)')).toBeTruthy()
  })
})
