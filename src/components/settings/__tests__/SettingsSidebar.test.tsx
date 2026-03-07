/**
 * Sarah — S-P0-02: SettingsSidebar tests
 */

import React from 'react'
import { render, screen } from '@testing-library/react'

let mockPathname = '/dashboard/settings'
jest.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}))

jest.mock('next/link', () => {
  return ({ children, href, ...rest }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...rest}>{children}</a>
  )
})

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    User: icon('user'),
    Shield: icon('shield'),
    HardDrive: icon('harddrive'),
    Download: icon('download'),
    CreditCard: icon('creditcard'),
  }
})

import SettingsSidebar from '../SettingsSidebar'

describe('SettingsSidebar', () => {
  beforeEach(() => {
    mockPathname = '/dashboard/settings'
  })

  it('renders Settings heading', () => {
    render(<SettingsSidebar />)
    expect(screen.getByText('Settings')).toBeTruthy()
  })

  it('renders all 5 navigation items', () => {
    render(<SettingsSidebar />)
    expect(screen.getByText('Profile')).toBeTruthy()
    expect(screen.getByText('Security')).toBeTruthy()
    expect(screen.getByText('Vault')).toBeTruthy()
    expect(screen.getByText('Billing')).toBeTruthy()
    expect(screen.getByText('Export')).toBeTruthy()
  })

  it('links to correct hrefs', () => {
    render(<SettingsSidebar />)
    expect(screen.getByText('Profile').closest('a')?.getAttribute('href')).toBe('/dashboard/settings')
    expect(screen.getByText('Security').closest('a')?.getAttribute('href')).toBe('/dashboard/settings/security')
    expect(screen.getByText('Export').closest('a')?.getAttribute('href')).toBe('/dashboard/settings/export')
  })

  it('renders nav element', () => {
    const { container } = render(<SettingsSidebar />)
    expect(container.querySelector('nav')).toBeTruthy()
  })
})
