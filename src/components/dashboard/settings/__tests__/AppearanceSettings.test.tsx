/**
 * Sarah — S-P0-02: AppearanceSettings tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return { Check: icon('check'), LayoutGrid: icon('layout'), Glasses: icon('glasses') }
})

const mockSettings = {
  theme: 'cobalt' as string,
  setTheme: jest.fn(),
  density: 'comfortable' as string,
  setDensity: jest.fn(),
  fontScale: 'normal' as string,
  setFontScale: jest.fn(),
  notifications: { email: true, push: false, audit: true },
  setNotification: jest.fn(),
}

jest.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => mockSettings,
}))

jest.mock('../shared', () => ({
  ToggleSetting: ({ label, enabled }: { label: string; enabled: boolean }) => (
    <div data-testid={`toggle-${label}`}>{label}: {enabled ? 'on' : 'off'}</div>
  ),
}))

import { AppearanceSettings, NotificationSettings } from '../AppearanceSettings'

describe('AppearanceSettings', () => {
  it('renders Theme heading', () => {
    render(<AppearanceSettings />)
    expect(screen.getByText('Theme')).toBeTruthy()
  })

  it('renders 4 theme options', () => {
    render(<AppearanceSettings />)
    expect(screen.getByText('Midnight Cobalt')).toBeTruthy()
    expect(screen.getByText('Cyber Noir')).toBeTruthy()
    expect(screen.getByText('Forest Dark')).toBeTruthy()
    expect(screen.getByText('Obsidian Gold')).toBeTruthy()
  })

  it('calls setTheme on theme click', () => {
    render(<AppearanceSettings />)
    fireEvent.click(screen.getByText('Cyber Noir'))
    expect(mockSettings.setTheme).toHaveBeenCalledWith('noir')
  })

  it('renders density options', () => {
    render(<AppearanceSettings />)
    expect(screen.getByText('Compact')).toBeTruthy()
    expect(screen.getByText('Comfortable')).toBeTruthy()
  })

  it('renders font scale options', () => {
    render(<AppearanceSettings />)
    expect(screen.getByText('Normal')).toBeTruthy()
    expect(screen.getByText('Large')).toBeTruthy()
    expect(screen.getByText('Extra Large')).toBeTruthy()
  })
})

describe('NotificationSettings', () => {
  it('renders notification heading', () => {
    render(<NotificationSettings />)
    expect(screen.getByText('Notification Preferences')).toBeTruthy()
  })

  it('renders 3 toggle settings', () => {
    render(<NotificationSettings />)
    expect(screen.getByTestId('toggle-Email Notifications')).toBeTruthy()
    expect(screen.getByTestId('toggle-Push Notifications')).toBeTruthy()
    expect(screen.getByTestId('toggle-Audit Trail Alerts')).toBeTruthy()
  })
})
