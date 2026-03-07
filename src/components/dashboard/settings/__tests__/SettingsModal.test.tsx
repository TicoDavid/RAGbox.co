/**
 * Sarah — S-P0-02: SettingsModal tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    Settings: icon('settings'), User: icon('user'), Globe: icon('globe'),
    CreditCard: icon('credit'), Key: icon('key'), Brain: icon('brain'),
    Palette: icon('palette'), Bell: icon('bell'), Shield: icon('shield'),
    FileText: icon('file-text'), MessageSquare: icon('message'), X: icon('x'),
  }
})

jest.mock('../ProfileSettings', () => ({ ProfileSettings: () => <div data-testid="profile">Profile</div> }))
jest.mock('../LanguageBillingSettings', () => ({ LanguageSettings: () => <div data-testid="language">Language</div>, BillingSettings: () => <div data-testid="billing">Billing</div> }))
jest.mock('../SecuritySettings', () => ({ SecuritySettings: () => <div data-testid="security">Security</div> }))
jest.mock('../SupportSettings', () => ({ DocumentationSettings: () => <div data-testid="docs">Docs</div>, ReportIssueSettings: () => <div data-testid="report">Report</div> }))
jest.mock('../APIKeysSettings', () => ({ APIKeysSettings: () => <div data-testid="connections">Connections</div> }))
jest.mock('../AIModelSettings', () => ({ AIModelSettings: () => <div data-testid="aimodel">AI Model</div> }))
jest.mock('../AppearanceSettings', () => ({ AppearanceSettings: () => <div data-testid="appearance">Appearance</div>, NotificationSettings: () => <div data-testid="alerts">Alerts</div> }))

import { SettingsModal } from '../SettingsModal'

describe('SettingsModal', () => {
  it('renders System Control Panel heading', () => {
    render(<SettingsModal onClose={jest.fn()} />)
    expect(screen.getByText('System Control Panel')).toBeTruthy()
  })

  it('renders sidebar categories', () => {
    render(<SettingsModal onClose={jest.fn()} />)
    expect(screen.getByText('General')).toBeTruthy()
    expect(screen.getByText('Intelligence')).toBeTruthy()
    expect(screen.getByText('Interface')).toBeTruthy()
    expect(screen.getByText('System')).toBeTruthy()
    expect(screen.getByText('Support')).toBeTruthy()
  })

  it('renders Connections by default', () => {
    render(<SettingsModal onClose={jest.fn()} />)
    expect(screen.getByTestId('connections')).toBeTruthy()
  })

  it('switches to Profile section', () => {
    render(<SettingsModal onClose={jest.fn()} />)
    fireEvent.click(screen.getByText('Profile'))
    expect(screen.getByTestId('profile')).toBeTruthy()
  })

  it('calls onClose on close button', () => {
    const onClose = jest.fn()
    render(<SettingsModal onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('Close settings'))
    expect(onClose).toHaveBeenCalled()
  })

  it('respects initialSection prop', () => {
    render(<SettingsModal onClose={jest.fn()} initialSection="appearance" />)
    expect(screen.getByTestId('appearance')).toBeTruthy()
  })
})
