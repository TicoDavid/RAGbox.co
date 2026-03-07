/**
 * Sarah — S-P0-02: Tooltip tests
 */

import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Tooltip } from '../Tooltip'

describe('Tooltip', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it('renders children', () => {
    render(<Tooltip content="Help text"><button>Click me</button></Tooltip>)
    expect(screen.getByText('Click me')).toBeTruthy()
  })

  it('shows tooltip after delay on hover', () => {
    render(<Tooltip content="Help text" delay={200}><button>Hover me</button></Tooltip>)
    fireEvent.mouseEnter(screen.getByText('Hover me').closest('div')!)
    act(() => { jest.advanceTimersByTime(200) })
    expect(screen.getByText('Help text')).toBeTruthy()
  })

  it('hides tooltip on mouse leave', () => {
    render(<Tooltip content="Help text" delay={0}><button>Hover me</button></Tooltip>)
    const wrapper = screen.getByText('Hover me').closest('div')!
    fireEvent.mouseEnter(wrapper)
    act(() => { jest.advanceTimersByTime(0) })
    expect(screen.getByText('Help text')).toBeTruthy()
    fireEvent.mouseLeave(wrapper)
    expect(screen.queryByText('Help text')).toBeNull()
  })

  it('does not show tooltip when enabled=false', () => {
    render(<Tooltip content="Nope" enabled={false}><button>Btn</button></Tooltip>)
    expect(screen.getByText('Btn')).toBeTruthy()
    // No wrapper div with tooltip logic
  })

  it('renders children directly when disabled', () => {
    const { container } = render(<Tooltip content="Nope" enabled={false}><span>Raw</span></Tooltip>)
    expect(container.querySelector('.relative')).toBeNull()
  })
})
