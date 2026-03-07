/**
 * Sarah — S-P0-02: VaultRail tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('@/stores/vaultStore', () => ({
  useVaultStore: (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ storage: { used: 5242880, total: 1073741824 }, documents: { a: 1, b: 2 } }),
}))

jest.mock('sonner', () => ({ toast: { info: jest.fn() } }))

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return { FolderOpen: icon('folder'), Upload: icon('upload'), Cloud: icon('cloud') }
})

import { VaultRail } from '../VaultRail'

describe('VaultRail', () => {
  const onExpand = jest.fn()
  const onUpload = jest.fn()

  beforeEach(() => jest.clearAllMocks())

  it('renders Open Vault, Upload Files, Cloud Storage buttons', () => {
    render(<VaultRail onExpand={onExpand} onUpload={onUpload} />)
    expect(screen.getByLabelText('Open Vault')).toBeTruthy()
    expect(screen.getByLabelText('Upload Files')).toBeTruthy()
    expect(screen.getByLabelText('Cloud Storage')).toBeTruthy()
  })

  it('calls onExpand when Open Vault is clicked', () => {
    render(<VaultRail onExpand={onExpand} onUpload={onUpload} />)
    fireEvent.click(screen.getByLabelText('Open Vault'))
    expect(onExpand).toHaveBeenCalled()
  })

  it('calls onUpload when Upload Files is clicked', () => {
    render(<VaultRail onExpand={onExpand} onUpload={onUpload} />)
    fireEvent.click(screen.getByLabelText('Upload Files'))
    expect(onUpload).toHaveBeenCalled()
  })
})
