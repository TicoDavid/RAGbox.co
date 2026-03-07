/**
 * Sarah — S-P0-02: Footer tests
 */

import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('next/link', () => {
  return ({ children, href, ...props }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} {...props}>{children}</a>
  )
})

jest.mock('next/image', () => {
  return (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img {...props} />
  )
})

import Footer from '../Footer'

describe('Footer', () => {
  it('renders copyright text', () => {
    render(<Footer />)
    expect(screen.getByText(/ConnexUS AI Inc/)).toBeTruthy()
  })

  it('renders Product section', () => {
    render(<Footer />)
    expect(screen.getByText('Product')).toBeTruthy()
    expect(screen.getByText('Intelligence Engine')).toBeTruthy()
  })

  it('renders Company section', () => {
    render(<Footer />)
    expect(screen.getByText('Company')).toBeTruthy()
    expect(screen.getByText('About Us')).toBeTruthy()
  })

  it('renders system status indicator', () => {
    render(<Footer />)
    expect(screen.getByText('All Systems Operational')).toBeTruthy()
  })

  it('renders Privacy, Terms, Security links', () => {
    render(<Footer />)
    expect(screen.getByText('Privacy Policy')).toBeTruthy()
    expect(screen.getByText('Terms of Service')).toBeTruthy()
  })

  it('renders Pricing link', () => {
    render(<Footer />)
    const link = screen.getByText('Pricing')
    expect(link.closest('a')?.getAttribute('href')).toBe('/pricing')
  })

  it('renders contact mailto link', () => {
    render(<Footer />)
    const link = screen.getByText('Contact')
    expect(link.closest('a')?.getAttribute('href')).toBe('mailto:david@theconnexus.ai')
  })
})
