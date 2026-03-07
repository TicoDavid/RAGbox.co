/**
 * Sarah — S-P0-02: KBHealthPanel tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    Activity: icon('activity'),
    Clock: icon('clock'),
    Layers: icon('layers'),
    CheckCircle2: icon('check'),
    AlertTriangle: icon('alert'),
    XCircle: icon('x-circle'),
    Loader2: icon('loader'),
    ChevronDown: icon('chevron-down'),
    ChevronUp: icon('chevron-up'),
  }
})

const mockStore = {
  healthChecks: [] as Array<{ checkType: string; status: string; details: Record<string, unknown> }>,
  healthLoading: false,
  lastHealthRun: null as string | null,
  runHealthCheck: jest.fn(),
  fetchHealthHistory: jest.fn(),
}

jest.mock('@/stores/contentIntelligenceStore', () => ({
  useContentIntelligenceStore: (sel: (s: typeof mockStore) => unknown) => sel(mockStore),
}))

import { KBHealthPanel } from '../KBHealthPanel'

describe('KBHealthPanel', () => {
  beforeEach(() => {
    mockStore.healthChecks = []
    mockStore.healthLoading = false
    mockStore.lastHealthRun = null
    jest.clearAllMocks()
  })

  it('renders KB Health heading', () => {
    render(<KBHealthPanel vaultId="v1" />)
    expect(screen.getByText('KB Health')).toBeTruthy()
  })

  it('calls fetchHealthHistory on mount', () => {
    render(<KBHealthPanel vaultId="v1" />)
    expect(mockStore.fetchHealthHistory).toHaveBeenCalledWith('v1')
  })

  it('renders Run Check button', () => {
    render(<KBHealthPanel vaultId="v1" />)
    expect(screen.getByText('Run Check')).toBeTruthy()
  })

  it('calls runHealthCheck on button click', () => {
    render(<KBHealthPanel vaultId="v1" />)
    fireEvent.click(screen.getByText('Run Check'))
    expect(mockStore.runHealthCheck).toHaveBeenCalledWith('v1')
  })

  it('shows empty state when no checks', () => {
    render(<KBHealthPanel vaultId="v1" />)
    expect(screen.getByText(/No health checks yet/)).toBeTruthy()
  })
})
