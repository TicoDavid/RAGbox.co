/**
 * Sarah — S-P0-02: ProfileSettings tests
 */

import React from 'react'
import { render, screen, act } from '@testing-library/react'

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return { Loader2: icon('loader') }
})

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
jest.mock('@/lib/logger', () => ({ logger: { error: jest.fn() } }))

jest.mock('../shared', () => ({
  SectionHeader: ({ title }: { title: string }) => <h3>{title}</h3>,
}))

jest.mock('next-auth/react', () => ({
  useSession: () => ({
    data: {
      user: { name: 'Alice Smith', email: 'alice@test.com' },
    },
    update: jest.fn(),
  }),
}))

import { ProfileSettings } from '../ProfileSettings'

describe('ProfileSettings', () => {
  beforeEach(() => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true, data: {} }),
      })
    ) as jest.Mock
  })

  it('renders Profile heading', async () => {
    await act(async () => {
      render(<ProfileSettings />)
    })
    expect(screen.getByText('Profile')).toBeTruthy()
  })

  it('renders user name', async () => {
    await act(async () => {
      render(<ProfileSettings />)
    })
    expect(screen.getByText('Alice Smith')).toBeTruthy()
  })

  it('renders user email', async () => {
    await act(async () => {
      render(<ProfileSettings />)
    })
    expect(screen.getByText('alice@test.com')).toBeTruthy()
  })

  it('renders Edit Profile button', async () => {
    await act(async () => {
      render(<ProfileSettings />)
    })
    expect(screen.getByText('Edit Profile')).toBeTruthy()
  })

  it('renders ADMINISTRATOR badge', async () => {
    await act(async () => {
      render(<ProfileSettings />)
    })
    expect(screen.getByText('ADMINISTRATOR')).toBeTruthy()
  })
})
