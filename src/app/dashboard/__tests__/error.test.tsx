/**
 * @jest-environment jsdom
 */

/**
 * EPIC-012 STORY-137: DashboardError Boundary Tests
 *
 * Render error component with mock error, verify retry button,
 * Sentry capture, and user-facing copy.
 *
 * — Sarah, Engineering
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock Sentry
const mockCaptureException = jest.fn()
jest.mock('@sentry/nextjs', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}))

import DashboardError from '../error'

describe('DashboardError', () => {
  const mockReset = jest.fn()
  const testError = Object.assign(new Error('Test dashboard failure'), {
    digest: 'digest-123',
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders error heading and safety message', () => {
    render(<DashboardError error={testError} reset={mockReset} />)

    expect(screen.getByText('Dashboard Error')).toBeTruthy()
    expect(
      screen.getByText('Something went wrong loading the dashboard. Your data is safe.'),
    ).toBeTruthy()
  })

  it('renders Retry button that calls reset', () => {
    render(<DashboardError error={testError} reset={mockReset} />)

    const retryButton = screen.getByText('Retry')
    expect(retryButton).toBeTruthy()

    fireEvent.click(retryButton)
    expect(mockReset).toHaveBeenCalledTimes(1)
  })

  it('renders Reload Page link to /dashboard', () => {
    render(<DashboardError error={testError} reset={mockReset} />)

    const reloadLink = screen.getByText('Reload Page')
    expect(reloadLink).toBeTruthy()
    expect(reloadLink.closest('a')?.getAttribute('href')).toBe('/dashboard')
  })

  it('reports error to Sentry with digest metadata', () => {
    render(<DashboardError error={testError} reset={mockReset} />)

    expect(mockCaptureException).toHaveBeenCalledWith(
      testError,
      expect.objectContaining({
        extra: { digest: 'digest-123', component: 'DashboardError' },
      }),
    )
  })
})
