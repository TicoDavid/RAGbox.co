/**
 * Sarah — S-P0-02: QuickAccess tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return { Clock: icon('clock'), Star: icon('star'), Users: icon('users') }
})

import QuickAccess from '../QuickAccess'

describe('QuickAccess', () => {
  const baseProps = {
    recentCount: 5,
    favoritesCount: 3,
    sharedCount: 2,
    activeSection: null as 'recent' | 'favorites' | 'shared' | null,
    onSelect: jest.fn(),
  }

  it('renders "Quick Access" header', () => {
    render(<QuickAccess {...baseProps} />)
    expect(screen.getByText('Quick Access')).toBeTruthy()
  })

  it('renders 3 section buttons', () => {
    render(<QuickAccess {...baseProps} />)
    expect(screen.getByText('Recent')).toBeTruthy()
    expect(screen.getByText('Favorites')).toBeTruthy()
    expect(screen.getByText('Shared')).toBeTruthy()
  })

  it('shows counts', () => {
    render(<QuickAccess {...baseProps} />)
    expect(screen.getByText('5')).toBeTruthy()
    expect(screen.getByText('3')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
  })

  it('calls onSelect on button click', () => {
    const onSelect = jest.fn()
    render(<QuickAccess {...baseProps} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Recent'))
    expect(onSelect).toHaveBeenCalledWith('recent')
  })

  it('toggles off active section on re-click', () => {
    const onSelect = jest.fn()
    render(<QuickAccess {...baseProps} activeSection="recent" onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Recent'))
    expect(onSelect).toHaveBeenCalledWith(null)
  })
})
