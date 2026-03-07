/**
 * Sarah — S-P0-02: ToolConfirmationDialog tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('framer-motion', () => {
  const R = require('react')
  const wrap = (tag: string) =>
    R.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLElement>) => {
      const filtered = Object.fromEntries(
        Object.entries(props).filter(([k]) => !['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap', 'variants', 'viewport', 'whileInView'].includes(k))
      )
      return R.createElement(tag, { ...filtered, ref }, children)
    })
  return { motion: { div: wrap('div'), button: wrap('button') }, AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</> }
})

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    AlertTriangle: icon('alert-triangle'),
    Shield: icon('shield'),
    FileText: icon('file-text'),
    Check: icon('check'),
    X: icon('x'),
    Mic: icon('mic'),
    Mail: icon('mail'),
    MessageSquare: icon('message-square'),
    Send: icon('send'),
  }
})

jest.mock('@/stores/mercuryStore', () => ({
  useMercuryStore: () => null,
}))

import { ToolConfirmationDialog } from '../ToolConfirmationDialog'

const baseRequest = {
  toolCallId: 'tc-1',
  toolName: 'search_documents',
  message: 'This will search your documents',
  severity: 'low' as const,
  expiresAt: Date.now() + 30000,
}

describe('ToolConfirmationDialog', () => {
  it('returns null when no request', () => {
    const { container } = render(
      <ToolConfirmationDialog request={null} onConfirm={jest.fn()} onDeny={jest.fn()} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders Confirm Action heading', () => {
    render(<ToolConfirmationDialog request={baseRequest} onConfirm={jest.fn()} onDeny={jest.fn()} />)
    expect(screen.getByText('Confirm Action')).toBeTruthy()
  })

  it('renders tool name with spaces', () => {
    render(<ToolConfirmationDialog request={baseRequest} onConfirm={jest.fn()} onDeny={jest.fn()} />)
    expect(screen.getByText('search documents')).toBeTruthy()
  })

  it('renders message', () => {
    render(<ToolConfirmationDialog request={baseRequest} onConfirm={jest.fn()} onDeny={jest.fn()} />)
    expect(screen.getByText('This will search your documents')).toBeTruthy()
  })

  it('calls onConfirm with toolCallId on Confirm click', () => {
    const onConfirm = jest.fn()
    render(<ToolConfirmationDialog request={baseRequest} onConfirm={onConfirm} onDeny={jest.fn()} />)
    fireEvent.click(screen.getByText('Confirm'))
    expect(onConfirm).toHaveBeenCalledWith('tc-1')
  })

  it('calls onDeny with toolCallId on Cancel click', () => {
    const onDeny = jest.fn()
    render(<ToolConfirmationDialog request={baseRequest} onConfirm={jest.fn()} onDeny={onDeny} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onDeny).toHaveBeenCalledWith('tc-1')
  })

  it('shows auto-cancel countdown', () => {
    render(<ToolConfirmationDialog request={baseRequest} onConfirm={jest.fn()} onDeny={jest.fn()} />)
    expect(screen.getByText(/Auto-cancel in/)).toBeTruthy()
  })
})
