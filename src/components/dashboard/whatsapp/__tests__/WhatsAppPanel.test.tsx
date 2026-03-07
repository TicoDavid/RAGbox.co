/**
 * Sarah — S-P0-02: WhatsAppPanel tests
 */

import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('framer-motion', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const R = require('react')
  const wrap = (tag: string) =>
    R.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLElement>) => {
      const filtered = Object.fromEntries(
        Object.entries(props).filter(([k]) => !['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap', 'variants', 'viewport', 'whileInView', 'mode'].includes(k))
      )
      return R.createElement(tag, { ...filtered, ref }, children)
    })
  return { motion: { div: wrap('div') }, AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</> }
})

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    ArrowLeft: icon('back'), Search: icon('search'), Send: icon('send'),
    MessageCircle: icon('msg'), Phone: icon('phone'), ToggleLeft: icon('togglel'),
    ToggleRight: icon('toggler'), Bot: icon('bot'), User: icon('user'),
    CheckCheck: icon('checkcheck'), Check: icon('check'), Clock: icon('clock'),
    AlertCircle: icon('alert'),
  }
})

const mockStore: Record<string, unknown> = {
  activeConversationId: null,
  setActiveConversation: jest.fn(),
  fetchConversations: jest.fn(),
  fetchMessages: jest.fn(),
  conversations: [],
  isLoading: false,
}

jest.mock('@/stores/whatsappStore', () => ({
  useWhatsAppStore: (sel: (s: Record<string, unknown>) => unknown) => sel(mockStore),
}))

import { WhatsAppPanel } from '../WhatsAppPanel'

describe('WhatsAppPanel', () => {
  it('renders WhatsApp heading', () => {
    render(<WhatsAppPanel />)
    expect(screen.getByText('WhatsApp')).toBeTruthy()
  })

  it('renders search placeholder', () => {
    render(<WhatsAppPanel />)
    expect(screen.getByPlaceholderText('Search conversations...')).toBeTruthy()
  })

  it('shows empty state', () => {
    render(<WhatsAppPanel />)
    expect(screen.getByText('No conversations yet')).toBeTruthy()
  })

  it('calls fetchConversations on mount', () => {
    render(<WhatsAppPanel />)
    expect(mockStore.fetchConversations).toHaveBeenCalled()
  })
})
