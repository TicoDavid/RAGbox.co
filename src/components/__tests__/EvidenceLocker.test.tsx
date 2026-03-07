/**
 * Sarah — S-P0-02: EvidenceLocker tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    FileText: icon('file-text'),
    Plus: icon('plus'),
    Loader2: icon('loader'),
    CheckCircle2: icon('check'),
    AlertCircle: icon('alert'),
  }
})

import EvidenceLocker from '../EvidenceLocker'

describe('EvidenceLocker', () => {
  const baseProps = {
    files: [] as { id: string; name: string; type: 'pdf' | 'docx' | 'xlsx' | 'txt'; status: 'indexing' | 'ready' | 'error'; size: string; timestamp: string }[],
    selectedId: null,
    onSelect: jest.fn(),
    onUpload: jest.fn(),
  }

  it('renders vault header', () => {
    render(<EvidenceLocker {...baseProps} />)
    expect(screen.getByText('VAULT: PRIVATE')).toBeTruthy()
  })

  it('shows file count', () => {
    render(<EvidenceLocker {...baseProps} />)
    expect(screen.getByText('0 DOCS')).toBeTruthy()
  })

  it('shows upload button', () => {
    render(<EvidenceLocker {...baseProps} />)
    expect(screen.getByText('MOUNT EVIDENCE')).toBeTruthy()
  })

  it('calls onUpload when upload button clicked', () => {
    render(<EvidenceLocker {...baseProps} />)
    fireEvent.click(screen.getByText('MOUNT EVIDENCE'))
    expect(baseProps.onUpload).toHaveBeenCalled()
  })

  it('renders file names', () => {
    const files = [
      { id: 'f1', name: 'report.pdf', type: 'pdf' as const, status: 'ready' as const, size: '1.2 MB', timestamp: '2026-03-07' },
    ]
    render(<EvidenceLocker {...baseProps} files={files} />)
    expect(screen.getByText('report.pdf')).toBeTruthy()
    expect(screen.getByText('1 DOCS')).toBeTruthy()
  })

  it('calls onSelect when file clicked', () => {
    const onSelect = jest.fn()
    const files = [
      { id: 'f1', name: 'report.pdf', type: 'pdf' as const, status: 'ready' as const, size: '1.2 MB', timestamp: '2026-03-07' },
    ]
    render(<EvidenceLocker {...baseProps} files={files} onSelect={onSelect} />)
    fireEvent.click(screen.getByText('report.pdf'))
    expect(onSelect).toHaveBeenCalledWith('f1')
  })
})
