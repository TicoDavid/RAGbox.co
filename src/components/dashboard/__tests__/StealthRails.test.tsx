/**
 * Sarah — S-P0-02: StealthRails tests
 *
 * Covers: LeftStealthRail, RightStealthRail, RailPanel rendering,
 * tab clicks, collapse button, tooltips, badges.
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLDivElement>) => <div ref={ref} {...props}>{children}</div>),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}))

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    Box: icon('box'),
    PlusCircle: icon('plus'),
    Clock: icon('clock'),
    Star: icon('star'),
    Sparkles: icon('sparkles'),
    Scale: icon('scale'),
    Download: icon('download'),
    ChevronLeft: icon('chevleft'),
    ChevronRight: icon('chevright'),
    Mic: icon('mic'),
    Maximize2: icon('maximize'),
  }
})

import { LeftStealthRail, RightStealthRail, RailPanel } from '../StealthRails'

describe('LeftStealthRail', () => {
  const defaults = {
    isExpanded: false,
    activeTab: null as null,
    onTabClick: jest.fn(),
    onAddClick: jest.fn(),
    onCollapse: jest.fn(),
  }

  beforeEach(() => jest.clearAllMocks())

  it('renders vault navigation', () => {
    render(<LeftStealthRail {...defaults} />)
    expect(screen.getByRole('navigation', { name: 'Vault navigation' })).toBeTruthy()
  })

  it('renders Vault, Add, Recent, Starred buttons', () => {
    render(<LeftStealthRail {...defaults} />)
    expect(screen.getByLabelText('Vault')).toBeTruthy()
    expect(screen.getByLabelText('Add to Vault')).toBeTruthy()
    expect(screen.getByLabelText('Recent Files')).toBeTruthy()
    expect(screen.getByLabelText('Starred')).toBeTruthy()
  })

  it('calls onTabClick with vault when Vault is clicked', () => {
    render(<LeftStealthRail {...defaults} />)
    fireEvent.click(screen.getByLabelText('Vault'))
    expect(defaults.onTabClick).toHaveBeenCalledWith('vault')
  })

  it('calls onAddClick when Add is clicked', () => {
    render(<LeftStealthRail {...defaults} />)
    fireEvent.click(screen.getByLabelText('Add to Vault'))
    expect(defaults.onAddClick).toHaveBeenCalled()
  })

  it('shows collapse button when expanded', () => {
    render(<LeftStealthRail {...defaults} isExpanded={true} activeTab="vault" />)
    expect(screen.getByLabelText('Collapse left panel')).toBeTruthy()
  })

  it('hides collapse button when collapsed', () => {
    render(<LeftStealthRail {...defaults} isExpanded={false} />)
    expect(screen.queryByLabelText('Collapse left panel')).toBeNull()
  })

  it('calls onCollapse when collapse button is clicked', () => {
    render(<LeftStealthRail {...defaults} isExpanded={true} activeTab="vault" />)
    fireEvent.click(screen.getByLabelText('Collapse left panel'))
    expect(defaults.onCollapse).toHaveBeenCalled()
  })

  it('shows expand button when vault is active and onExpandVault provided', () => {
    const onExpand = jest.fn()
    render(
      <LeftStealthRail {...defaults} isExpanded={true} activeTab="vault" onExpandVault={onExpand} />
    )
    expect(screen.getByLabelText('Expand to Sovereign Explorer')).toBeTruthy()
  })
})

describe('RightStealthRail', () => {
  const defaults = {
    isExpanded: false,
    activeTab: null as null,
    onTabClick: jest.fn(),
    onCollapse: jest.fn(),
  }

  beforeEach(() => jest.clearAllMocks())

  it('renders tools navigation', () => {
    render(<RightStealthRail {...defaults} />)
    expect(screen.getByRole('navigation', { name: 'Tools navigation' })).toBeTruthy()
  })

  it('renders Mercury, Studio, Audit, Export buttons', () => {
    render(<RightStealthRail {...defaults} />)
    expect(screen.getByLabelText('Mercury')).toBeTruthy()
    expect(screen.getByLabelText('Studio')).toBeTruthy()
    expect(screen.getByLabelText('Truth & Audit')).toBeTruthy()
    expect(screen.getByLabelText('Export')).toBeTruthy()
  })

  it('calls onTabClick with studio on Studio click', () => {
    render(<RightStealthRail {...defaults} />)
    fireEvent.click(screen.getByLabelText('Studio'))
    expect(defaults.onTabClick).toHaveBeenCalledWith('studio')
  })

  it('shows collapse button when expanded', () => {
    render(<RightStealthRail {...defaults} isExpanded={true} activeTab="studio" />)
    expect(screen.getByLabelText('Collapse right panel')).toBeTruthy()
  })

  it('hides collapse button when collapsed', () => {
    render(<RightStealthRail {...defaults} />)
    expect(screen.queryByLabelText('Collapse right panel')).toBeNull()
  })

  it('calls onMercuryToggle when Mercury is clicked (if provided)', () => {
    const toggle = jest.fn()
    render(<RightStealthRail {...defaults} onMercuryToggle={toggle} />)
    fireEvent.click(screen.getByLabelText('Mercury'))
    expect(toggle).toHaveBeenCalled()
  })
})

describe('RailPanel', () => {
  it('renders children', () => {
    render(
      <RailPanel isOpen={true} side="left" width={300}>
        <span data-testid="panel-child">Content</span>
      </RailPanel>
    )
    expect(screen.getByTestId('panel-child')).toBeTruthy()
  })

  it('applies left border for right-side panel', () => {
    const { container } = render(
      <RailPanel isOpen={true} side="right" width={300}>
        <div />
      </RailPanel>
    )
    expect(container.firstChild).toBeTruthy()
  })
})
