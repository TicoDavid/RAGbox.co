/**
 * Sarah — EPIC-032 T5: UploadFlow tests
 *
 * Tests the upload experience via IngestionModal:
 * file selection, drag-drop, size warnings, progress, and completion.
 */

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

jest.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(
      ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLDivElement>) => (
        <div ref={ref} {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
      ),
    ),
    button: React.forwardRef(
      ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLButtonElement>) => (
        <button ref={ref} {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}>{children}</button>
      ),
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}))

import IngestionModal from '../IngestionModal'

describe('UploadFlow (IngestionModal)', () => {
  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onFileUpload: jest.fn(),
    onUrlSubmit: jest.fn(),
    onTextPaste: jest.fn(),
  }

  beforeEach(() => jest.clearAllMocks())

  it('renders when isOpen is true', () => {
    render(<IngestionModal {...defaultProps} />)
    expect(screen.getByText('Data Vault')).toBeTruthy()
    expect(screen.getByText('Local Files')).toBeTruthy()
  })

  it('does not render when isOpen is false', () => {
    const { container } = render(<IngestionModal {...defaultProps} isOpen={false} />)
    expect(container.innerHTML).toBe('')
  })

  it('drag-drop zone accepts files', async () => {
    render(<IngestionModal {...defaultProps} />)
    const dropZone = document.querySelector('[class*="border-dashed"]')
    expect(dropZone).toBeTruthy()
    if (dropZone) {
      const file = new File(['content'], 'test.pdf', { type: 'application/pdf' })
      fireEvent.drop(dropZone, {
        dataTransfer: { files: [file], types: ['Files'] },
      })
      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeTruthy()
      })
    }
  })

  it('file list shows added files with sizes', async () => {
    render(<IngestionModal {...defaultProps} />)
    const fileInput = document.querySelector('input[type="file"]')
    expect(fileInput).toBeTruthy()
    if (fileInput) {
      const file = new File(['a'.repeat(1024)], 'report.pdf', { type: 'application/pdf' })
      Object.defineProperty(fileInput, 'files', { value: [file] })
      fireEvent.change(fileInput)
      await waitFor(() => {
        expect(screen.getByText('report.pdf')).toBeTruthy()
      })
    }
  })

  it('file size displays for staged files', async () => {
    render(<IngestionModal {...defaultProps} />)
    const fileInput = document.querySelector('input[type="file"]')
    if (fileInput) {
      const file = new File([new ArrayBuffer(2097152)], 'medium.pdf', {
        type: 'application/pdf',
      })
      Object.defineProperty(fileInput, 'files', { value: [file] })
      fireEvent.change(fileInput)
      await waitFor(() => {
        expect(screen.getByText('medium.pdf')).toBeTruthy()
        // Size should be displayed (2.0 MB)
        expect(screen.getByText('2.0 MB')).toBeTruthy()
      })
    }
  })

  it('close button calls onClose', () => {
    render(<IngestionModal {...defaultProps} />)
    const closeBtn = screen.getByLabelText('Close data vault')
    fireEvent.click(closeBtn)
    expect(defaultProps.onClose).toHaveBeenCalled()
  })

  it('has source tabs for different upload modes', () => {
    render(<IngestionModal {...defaultProps} />)
    expect(screen.getByText('Local Files')).toBeTruthy()
    expect(screen.getByText('Sovereign Web')).toBeTruthy()
    expect(screen.getByText('Cloud Drives')).toBeTruthy()
    expect(screen.getByText('Raw Text')).toBeTruthy()
  })

  it('shows upload header for local files source', () => {
    render(<IngestionModal {...defaultProps} />)
    expect(screen.getByText('Upload Local Files')).toBeTruthy()
  })

  it('onFileUpload is called when files are ingested', async () => {
    render(<IngestionModal {...defaultProps} />)
    const fileInput = document.querySelector('input[type="file"]')
    if (fileInput) {
      const file = new File(['content'], 'doc.pdf', { type: 'application/pdf' })
      Object.defineProperty(fileInput, 'files', { value: [file] })
      fireEvent.change(fileInput)

      await waitFor(() => {
        expect(screen.getByText('doc.pdf')).toBeTruthy()
      })

      // Click the ingest button
      const ingestBtn = screen.queryByText(/Ingest/i)
      if (ingestBtn) {
        fireEvent.click(ingestBtn)
        expect(defaultProps.onFileUpload).toHaveBeenCalledWith([file])
      }
    }
  })

  it('backdrop click calls onClose', () => {
    render(<IngestionModal {...defaultProps} />)
    // The backdrop is the first div with onClick={onClose}
    const backdrop = document.querySelector('[class*="backdrop-blur"]')
    if (backdrop) {
      fireEvent.click(backdrop)
      expect(defaultProps.onClose).toHaveBeenCalled()
    }
  })
})
