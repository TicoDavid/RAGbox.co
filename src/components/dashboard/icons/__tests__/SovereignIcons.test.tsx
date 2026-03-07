/**
 * Sarah — S-P0-02: SovereignIcons tests
 */

import React from 'react'
import { render } from '@testing-library/react'
import {
  CrownIcon,
  VaultDiamondIcon,
  NetworkSystemIcon,
  ScopeIcon,
  BroadcastIcon,
  CircuitNodeIcon,
  ScaleIcon,
  ComplianceIcon,
  AuditorIcon,
  LanternIcon,
  PrivilegeKeyIcon,
  IdentityIcon,
} from '../SovereignIcons'

const icons = [
  { name: 'CrownIcon', Component: CrownIcon },
  { name: 'VaultDiamondIcon', Component: VaultDiamondIcon },
  { name: 'NetworkSystemIcon', Component: NetworkSystemIcon },
  { name: 'ScopeIcon', Component: ScopeIcon },
  { name: 'BroadcastIcon', Component: BroadcastIcon },
  { name: 'CircuitNodeIcon', Component: CircuitNodeIcon },
  { name: 'ScaleIcon', Component: ScaleIcon },
  { name: 'ComplianceIcon', Component: ComplianceIcon },
  { name: 'AuditorIcon', Component: AuditorIcon },
  { name: 'LanternIcon', Component: LanternIcon },
  { name: 'PrivilegeKeyIcon', Component: PrivilegeKeyIcon },
  { name: 'IdentityIcon', Component: IdentityIcon },
]

describe('SovereignIcons', () => {
  it.each(icons)('$name renders an SVG', ({ Component }) => {
    const { container } = render(<Component />)
    expect(container.querySelector('svg')).toBeTruthy()
  })

  it('accepts custom size', () => {
    const { container } = render(<CrownIcon size={32} />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('32')
    expect(svg?.getAttribute('height')).toBe('32')
  })

  it('accepts custom className', () => {
    const { container } = render(<ScopeIcon className="my-class" />)
    expect(container.querySelector('.my-class')).toBeTruthy()
  })

  it('uses default size 20', () => {
    const { container } = render(<PrivilegeKeyIcon />)
    const svg = container.querySelector('svg')
    expect(svg?.getAttribute('width')).toBe('20')
  })
})
