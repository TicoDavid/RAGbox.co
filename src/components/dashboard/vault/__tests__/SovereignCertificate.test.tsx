/**
 * Sarah — S-P0-02: SovereignCertificate tests
 */

import React from 'react'
import { render, screen } from '@testing-library/react'

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
  return { motion: { div: wrap('div'), span: wrap('span'), button: wrap('button') }, AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</> }
})

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return { User: icon('user'), Lock: icon('lock'), Fingerprint: icon('fingerprint'), Brain: icon('brain'), Shield: icon('shield'), Check: icon('check'), Loader2: icon('loader') }
})

jest.mock('next/image', () => (props: Record<string, unknown>) => <img {...props} />)

import { SovereignCertificate } from '../SovereignCertificate'

const mockDoc = {
  id: 'd1',
  name: 'contract.pdf',
  status: 'ready' as const,
  checksum: 'abc12345xyz67890',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
} as never

describe('SovereignCertificate', () => {
  it('renders Chain of Custody header', () => {
    render(<SovereignCertificate document={mockDoc} />)
    expect(screen.getByText('Chain of Custody')).toBeTruthy()
  })

  it('renders truncated checksum', () => {
    render(<SovereignCertificate document={mockDoc} />)
    expect(screen.getByText('abc12345...z67890')).toBeTruthy()
  })

  it('renders user name with Verified suffix', () => {
    render(<SovereignCertificate document={mockDoc} userName="John Doe" />)
    expect(screen.getByText('John Doe (Verified)')).toBeTruthy()
  })

  it('renders Verify Integrity button', () => {
    render(<SovereignCertificate document={mockDoc} />)
    expect(screen.getByText('Verify Integrity')).toBeTruthy()
  })
})
