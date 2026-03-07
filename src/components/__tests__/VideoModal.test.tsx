/**
 * Sarah — S-P0-02: VideoModal tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('framer-motion', () => {
  const FakeMotion = React.forwardRef<HTMLDivElement, Record<string, unknown>>(
    (props, ref) => {
      const { children, ...rest } = props
      const filtered = Object.fromEntries(
        Object.entries(rest).filter(([k]) => !['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap'].includes(k))
      )
      return <div ref={ref} {...filtered}>{children as React.ReactNode}</div>
    }
  )
  FakeMotion.displayName = 'FakeMotion'
  return { motion: { div: FakeMotion } }
})

import VideoModal from '../VideoModal'

describe('VideoModal', () => {
  it('returns null when not open', () => {
    const { container } = render(<VideoModal isOpen={false} onClose={jest.fn()} videoUrl="test.mp4" />)
    expect(container.innerHTML).toBe('')
  })

  it('renders video when open', () => {
    render(<VideoModal isOpen={true} onClose={jest.fn()} videoUrl="test.mp4" />)
    const video = document.querySelector('video')
    expect(video).toBeTruthy()
    expect(video?.getAttribute('src')).toBe('test.mp4')
  })

  it('calls onClose when close button clicked', () => {
    const onClose = jest.fn()
    render(<VideoModal isOpen={true} onClose={onClose} videoUrl="test.mp4" />)
    // Find button elements — close button is the one inside the modal
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])
    expect(onClose).toHaveBeenCalled()
  })
})
