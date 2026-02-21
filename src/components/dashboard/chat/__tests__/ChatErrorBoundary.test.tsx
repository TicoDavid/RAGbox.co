import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { ChatErrorBoundary } from '../ChatErrorBoundary'

// Suppress console.error from React and our error boundary during error tests
const originalConsoleError = console.error
beforeAll(() => {
  console.error = jest.fn()
})
afterAll(() => {
  console.error = originalConsoleError
})

// Use a module-level flag so we can flip it between the click and the re-render
let shouldThrow = false

function ProblemChild() {
  if (shouldThrow) throw new Error('Test explosion')
  return <div>All good</div>
}

describe('ChatErrorBoundary', () => {
  beforeEach(() => {
    shouldThrow = false
  })

  it('renders children when no error occurs', () => {
    render(
      <ChatErrorBoundary>
        <div>Hello world</div>
      </ChatErrorBoundary>
    )
    expect(screen.getByText('Hello world')).toBeInTheDocument()
  })

  it('shows error UI when child throws', () => {
    shouldThrow = true
    render(
      <ChatErrorBoundary>
        <ProblemChild />
      </ChatErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
    expect(screen.getByText(/click retry to reload/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('retry button resets error state and re-renders children', () => {
    shouldThrow = true
    render(
      <ChatErrorBoundary>
        <ProblemChild />
      </ChatErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    // Flip the flag BEFORE clicking retry so the re-render succeeds
    shouldThrow = false
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))

    expect(screen.getByText('All good')).toBeInTheDocument()
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument()
  })
})
