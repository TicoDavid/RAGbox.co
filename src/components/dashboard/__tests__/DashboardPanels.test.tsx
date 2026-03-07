/**
 * Sarah — S-P0-02: DashboardPanels tests
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
  return { motion: { div: wrap('div') }, AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</> }
})

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    Star: icon('star'),
    Shield: icon('shield'),
    FileText: icon('file-text'),
    Menu: icon('menu'),
    X: icon('x'),
    Wrench: icon('wrench'),
    MessageSquare: icon('message-square'),
    HardDrive: icon('hard-drive'),
    Bot: icon('bot'),
    Layers: icon('layers'),
  }
})

jest.mock('@/stores/vaultStore', () => ({
  useVaultStore: (sel: (s: { documents: Record<string, unknown> }) => unknown) => sel({ documents: {} }),
}))

jest.mock('@/lib/api', () => ({
  apiFetch: jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ data: { entries: [] } }) })),
}))

import { StarredPanel, MobileToolbar, MobileBottomNav } from '../DashboardPanels'

describe('StarredPanel', () => {
  it('renders Starred heading', () => {
    render(<StarredPanel />)
    expect(screen.getByText('Starred')).toBeTruthy()
  })

  it('shows empty state', () => {
    render(<StarredPanel />)
    expect(screen.getByText('No starred documents')).toBeTruthy()
  })
})

describe('MobileToolbar', () => {
  it('renders vault menu button', () => {
    render(<MobileToolbar onLeftOpen={jest.fn()} onRightOpen={jest.fn()} />)
    expect(screen.getByLabelText('Open vault menu')).toBeTruthy()
  })

  it('renders tools menu button', () => {
    render(<MobileToolbar onLeftOpen={jest.fn()} onRightOpen={jest.fn()} />)
    expect(screen.getByLabelText('Open tools menu')).toBeTruthy()
  })

  it('renders RAGbox label', () => {
    render(<MobileToolbar onLeftOpen={jest.fn()} onRightOpen={jest.fn()} />)
    expect(screen.getByText('RAGbox')).toBeTruthy()
  })
})

describe('MobileBottomNav', () => {
  it('renders 4 tab buttons', () => {
    render(<MobileBottomNav activeTab="chat" onTabChange={jest.fn()} />)
    expect(screen.getByText('Chat')).toBeTruthy()
    expect(screen.getByText('Vault')).toBeTruthy()
    expect(screen.getByText('Mercury')).toBeTruthy()
    expect(screen.getByText('Tools')).toBeTruthy()
  })

  it('calls onTabChange on tab click', () => {
    const onTabChange = jest.fn()
    render(<MobileBottomNav activeTab="chat" onTabChange={onTabChange} />)
    fireEvent.click(screen.getByText('Vault'))
    expect(onTabChange).toHaveBeenCalledWith('vault')
  })
})
