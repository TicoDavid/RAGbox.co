/**
 * Sarah — S-P0-02: AIModelSettings tests
 */

import React from 'react'
import { render, screen, act } from '@testing-library/react'

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
    ShieldCheck: icon('shield'), Key: icon('key'), Eye: icon('eye'), EyeOff: icon('eyeoff'),
    CheckCircle2: icon('check'), XCircle: icon('x'), Loader2: icon('loader'),
    ChevronDown: icon('chevron'), Wifi: icon('wifi'), Brain: icon('brain'),
    Save: icon('save'), Trash2: icon('trash'),
  }
})

jest.mock('@/lib/api', () => ({
  apiFetch: jest.fn(() => Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ data: { configured: false, policy: 'choice' } }),
  })),
}))

jest.mock('../ConnectionsHelpText', () => ({
  ConnectionsHelpText: () => <div data-testid="help-text">Help</div>,
}))

const mockSettings = {
  connections: [],
  addConnection: jest.fn(() => Promise.resolve({ id: 'c1' })),
  updateConnection: jest.fn(),
  deleteConnection: jest.fn(),
  setConnectionModel: jest.fn(),
  llmPolicy: 'choice',
  setLlmPolicy: jest.fn(),
  setActiveIntelligence: jest.fn(),
}

jest.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => mockSettings,
}))

import { AIModelSettings } from '../AIModelSettings'

describe('AIModelSettings', () => {
  it('renders AI Model Settings heading after load', async () => {
    await act(async () => {
      render(<AIModelSettings />)
    })
    expect(screen.getByText('AI Model Settings')).toBeTruthy()
  })

  it('renders AEGIS card', async () => {
    await act(async () => {
      render(<AIModelSettings />)
    })
    expect(screen.getByText('AEGIS')).toBeTruthy()
  })

  it('renders Private LLM section', async () => {
    await act(async () => {
      render(<AIModelSettings />)
    })
    expect(screen.getByText('Private LLM')).toBeTruthy()
  })

  it('renders Routing Policy section', async () => {
    await act(async () => {
      render(<AIModelSettings />)
    })
    expect(screen.getByText('Routing Policy')).toBeTruthy()
  })

  it('renders policy options', async () => {
    await act(async () => {
      render(<AIModelSettings />)
    })
    expect(screen.getByText('User Choice')).toBeTruthy()
    expect(screen.getByText('Private LLM Only')).toBeTruthy()
    expect(screen.getByText('AEGIS Only')).toBeTruthy()
  })
})
