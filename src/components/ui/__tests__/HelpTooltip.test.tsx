/**
 * Sarah — S-P0-02: HelpTooltip tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('lucide-react', () => ({
  HelpCircle: (props: React.ComponentProps<'svg'>) => <svg data-testid="help-icon" {...props} />,
}))

import { HelpTooltip } from '../HelpTooltip'

describe('HelpTooltip', () => {
  it('renders help icon', () => {
    render(<HelpTooltip content="Help text" />)
    expect(screen.getByTestId('help-icon')).toBeTruthy()
  })

  it('shows tooltip on mouse enter', () => {
    render(<HelpTooltip content="Detailed help" />)
    const wrapper = screen.getByTestId('help-icon').closest('span')!
    fireEvent.mouseEnter(wrapper)
    expect(screen.getByRole('tooltip')).toBeTruthy()
    expect(screen.getByText('Detailed help')).toBeTruthy()
  })

  it('hides tooltip on mouse leave (after delay)', () => {
    jest.useFakeTimers()
    render(<HelpTooltip content="Detailed help" />)
    const wrapper = screen.getByTestId('help-icon').closest('span')!
    fireEvent.mouseEnter(wrapper)
    expect(screen.getByText('Detailed help')).toBeTruthy()
    fireEvent.mouseLeave(wrapper)
    jest.advanceTimersByTime(200)
    expect(screen.queryByText('Detailed help')).toBeNull()
    jest.useRealTimers()
  })
})
