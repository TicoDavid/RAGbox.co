/**
 * Sarah — S-P0-02: Sidebar tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('lucide-react', () => ({
  Archive: (props: React.ComponentProps<'svg'>) => <svg data-testid="icon-archive" {...props} />,
}))

import { Sidebar } from '../Sidebar'

describe('Sidebar', () => {
  it('renders navigation with Vault button', () => {
    render(<Sidebar />)
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeTruthy()
    expect(screen.getByLabelText('Vault')).toBeTruthy()
  })

  it('calls onNavigate with item id on click', () => {
    const onNavigate = jest.fn()
    render(<Sidebar onNavigate={onNavigate} />)
    fireEvent.click(screen.getByLabelText('Vault'))
    expect(onNavigate).toHaveBeenCalledWith('box')
  })

  it('does not crash when onNavigate is not provided', () => {
    render(<Sidebar />)
    expect(() => fireEvent.click(screen.getByLabelText('Vault'))).not.toThrow()
  })
})
