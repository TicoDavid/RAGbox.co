/**
 * Sarah — S-P0-02: DashboardStats tests
 *
 * Covers: renders 4 stat cards, shows placeholder dashes before data loads,
 * displays correct labels.
 */

import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('@/lib/api', () => ({
  apiFetch: jest.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({}) })),
}))

jest.mock('lucide-react', () => ({
  FileText: (props: React.ComponentProps<'svg'>) => <svg data-testid="icon-filetext" {...props} />,
  Search: (props: React.ComponentProps<'svg'>) => <svg data-testid="icon-search" {...props} />,
  Shield: (props: React.ComponentProps<'svg'>) => <svg data-testid="icon-shield" {...props} />,
  Database: (props: React.ComponentProps<'svg'>) => <svg data-testid="icon-database" {...props} />,
}))

import { DashboardStats } from '../DashboardStats'

describe('DashboardStats', () => {
  it('renders 4 stat labels', () => {
    render(<DashboardStats />)
    expect(screen.getByText('Documents')).toBeTruthy()
    expect(screen.getByText('Chunks')).toBeTruthy()
    expect(screen.getByText('Privileged')).toBeTruthy()
    expect(screen.getByText('Queries')).toBeTruthy()
  })

  it('shows dash placeholders before data loads', () => {
    render(<DashboardStats />)
    const dashes = screen.getAllByText('-')
    expect(dashes.length).toBe(4)
  })

  it('renders all 4 icons', () => {
    render(<DashboardStats />)
    expect(screen.getByTestId('icon-filetext')).toBeTruthy()
    expect(screen.getByTestId('icon-search')).toBeTruthy()
    expect(screen.getByTestId('icon-shield')).toBeTruthy()
    expect(screen.getByTestId('icon-database')).toBeTruthy()
  })
})
