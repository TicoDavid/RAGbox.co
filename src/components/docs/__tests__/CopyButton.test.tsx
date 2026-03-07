/**
 * Sarah — S-P0-02: CopyButton tests
 */

import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { CopyButton } from '../CopyButton'

describe('CopyButton', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: jest.fn(() => Promise.resolve()) },
    })
  })

  it('renders Copy text', () => {
    render(<CopyButton text="hello" />)
    expect(screen.getByText('Copy')).toBeTruthy()
  })

  it('has aria-label "Copy code"', () => {
    render(<CopyButton text="hello" />)
    expect(screen.getByLabelText('Copy code')).toBeTruthy()
  })

  it('copies text to clipboard on click', async () => {
    render(<CopyButton text="hello world" />)
    await act(async () => {
      fireEvent.click(screen.getByText('Copy'))
    })
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello world')
  })

  it('shows "Copied!" after successful copy', async () => {
    render(<CopyButton text="hello" />)
    await act(async () => {
      fireEvent.click(screen.getByText('Copy'))
    })
    expect(screen.getByText('Copied!')).toBeTruthy()
  })
})
