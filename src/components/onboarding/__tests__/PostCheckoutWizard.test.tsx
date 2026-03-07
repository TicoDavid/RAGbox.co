/**
 * Sarah — S-P0-02: PostCheckoutWizard tests
 */

import React from 'react'
import { render } from '@testing-library/react'

jest.mock('framer-motion', () => {
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
    ArrowRight: icon('right'), ArrowLeft: icon('left'), Upload: icon('upload'),
    FileText: icon('file'), Mic: icon('mic'), X: icon('x'),
    CheckCircle2: icon('check'), Monitor: icon('monitor'), Headphones: icon('headphones'),
  }
})

jest.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
  useRouter: () => ({ replace: jest.fn() }),
}))

jest.mock('@/stores/vaultStore', () => ({
  useVaultStore: (sel: (s: Record<string, unknown>) => unknown) => sel({
    uploadDocument: jest.fn(),
  }),
}))

import { PostCheckoutWizard } from '../PostCheckoutWizard'

describe('PostCheckoutWizard', () => {
  it('returns null when checkout param is not success', () => {
    const { container } = render(<PostCheckoutWizard />)
    expect(container.innerHTML).toBe('')
  })
})
