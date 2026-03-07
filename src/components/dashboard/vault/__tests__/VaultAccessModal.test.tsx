/**
 * Sarah — S-P0-02: VaultAccessModal tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('framer-motion', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const R = require('react')
  const wrap = (tag: string) =>
    R.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLElement>) => {
      const filtered = Object.fromEntries(
        Object.entries(props).filter(([k]) => !['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap', 'variants', 'viewport', 'whileInView'].includes(k))
      )
      return R.createElement(tag, { ...filtered, ref }, children)
    })
  return { motion: { div: wrap('div'), span: wrap('span') }, AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</> }
})

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    X: icon('x'), Shield: icon('shield'), Eye: icon('eye'), EyeOff: icon('eyeoff'),
    Copy: icon('copy'), Check: icon('check'), Clock: icon('clock'), UserPlus: icon('userplus'),
    ChevronDown: icon('chevron'), Trash2: icon('trash'), AlertTriangle: icon('alert'),
    FileText: icon('filetext'), MessageSquare: icon('msg'), Settings: icon('settings'),
    Link2: icon('link'), Lock: icon('lock'), Globe: icon('globe'),
  }
})

import { VaultAccessModal } from '../VaultAccessModal'

const baseProps = {
  isOpen: true,
  onClose: jest.fn(),
  vaultName: 'Legal Docs',
  vaultId: 'v1',
  currentMembers: [],
  onGrantAccess: jest.fn(() => Promise.resolve()),
  onRevokeClearance: jest.fn(() => Promise.resolve()),
  onUpdateClearance: jest.fn(() => Promise.resolve()),
  onGenerateLink: jest.fn(() => Promise.resolve('https://link.test')),
}

describe('VaultAccessModal', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns null when closed', () => {
    const { container } = render(<VaultAccessModal {...baseProps} isOpen={false} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders heading when open', () => {
    render(<VaultAccessModal {...baseProps} />)
    expect(screen.getByText('Grant Vault Clearance')).toBeTruthy()
  })

  it('shows vault name', () => {
    render(<VaultAccessModal {...baseProps} />)
    expect(screen.getByText('Legal Docs')).toBeTruthy()
  })

  it('renders Issue New Clearance label', () => {
    render(<VaultAccessModal {...baseProps} />)
    expect(screen.getByText('Issue New Clearance')).toBeTruthy()
  })

  it('shows empty state when no members', () => {
    render(<VaultAccessModal {...baseProps} />)
    expect(screen.getByText('No external clearances granted')).toBeTruthy()
  })

  it('shows Done button that calls onClose', () => {
    render(<VaultAccessModal {...baseProps} />)
    fireEvent.click(screen.getByText('Done'))
    expect(baseProps.onClose).toHaveBeenCalled()
  })

  it('shows Grant button', () => {
    render(<VaultAccessModal {...baseProps} />)
    expect(screen.getByText('Grant')).toBeTruthy()
  })
})
