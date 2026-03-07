/**
 * Sarah — S-P0-02: ExportPanel tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return { Download: icon('download') }
})

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))

jest.mock('@/lib/api', () => ({
  apiFetch: jest.fn(() => Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(['data'])) })),
}))

import { ExportPanel } from '../ExportPanel'

describe('ExportPanel', () => {
  it('renders Export heading', () => {
    render(<ExportPanel />)
    expect(screen.getByText('Export')).toBeTruthy()
  })

  it('renders Export Conversation button', () => {
    render(<ExportPanel />)
    expect(screen.getByText('Export Conversation')).toBeTruthy()
  })

  it('renders Export Audit Trail section', () => {
    render(<ExportPanel />)
    expect(screen.getByText('Export Audit Trail')).toBeTruthy()
  })

  it('renders Export Vault Data button', () => {
    render(<ExportPanel />)
    expect(screen.getByText('Export Vault Data')).toBeTruthy()
  })

  it('renders format toggle pills (PDF, CSV, JSON)', () => {
    render(<ExportPanel />)
    expect(screen.getByText('PDF')).toBeTruthy()
    expect(screen.getByText('CSV')).toBeTruthy()
    expect(screen.getByText('JSON')).toBeTruthy()
  })

  it('renders Download button with default format', () => {
    render(<ExportPanel />)
    expect(screen.getByText('Download PDF')).toBeTruthy()
  })

  it('updates format on toggle click', () => {
    render(<ExportPanel />)
    fireEvent.click(screen.getByText('CSV'))
    expect(screen.getByText('Download CSV')).toBeTruthy()
  })
})
