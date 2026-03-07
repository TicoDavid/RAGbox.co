/**
 * Sarah — S-P0-02: ArtifactPreviewPane tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('framer-motion', () => {
  const R = require('react')
  const wrap = (tag: string) =>
    R.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLElement>) => {
      const filtered = Object.fromEntries(
        Object.entries(props).filter(([k]) => !['initial', 'animate', 'exit', 'transition', 'whileHover', 'whileTap', 'variants', 'viewport', 'whileInView'].includes(k))
      )
      return R.createElement(tag, { ...filtered, ref }, children)
    })
  return { motion: { div: wrap('div') } }
})

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return { X: icon('x'), Download: icon('download'), Maximize2: icon('maximize') }
})

jest.mock('../MindMapPreview', () => ({
  MindMapPreview: ({ title }: { title: string }) => <div data-testid="mindmap">{title}</div>,
}))

import { ArtifactPreviewPane } from '../ArtifactPreviewPane'

const baseProps = {
  isOpen: true,
  onClose: jest.fn(),
  onDownload: jest.fn(),
  name: 'Report.pdf',
}

describe('ArtifactPreviewPane', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns null when closed', () => {
    const { container } = render(<ArtifactPreviewPane {...baseProps} isOpen={false} />)
    expect(container.innerHTML).toBe('')
  })

  it('renders artifact name', () => {
    render(<ArtifactPreviewPane {...baseProps} />)
    expect(screen.getByText('Report.pdf')).toBeTruthy()
  })

  it('renders Artifact Preview subtitle', () => {
    render(<ArtifactPreviewPane {...baseProps} />)
    expect(screen.getByText('Artifact Preview')).toBeTruthy()
  })

  it('renders Download button that calls onDownload', () => {
    render(<ArtifactPreviewPane {...baseProps} />)
    fireEvent.click(screen.getByText('Download'))
    expect(baseProps.onDownload).toHaveBeenCalled()
  })

  it('shows preview text when provided', () => {
    render(<ArtifactPreviewPane {...baseProps} preview="Hello world" />)
    expect(screen.getByText('Hello world')).toBeTruthy()
  })

  it('shows empty state when no preview', () => {
    render(<ArtifactPreviewPane {...baseProps} />)
    expect(screen.getByText('Preview not available')).toBeTruthy()
  })

  it('renders MindMapPreview for mindmap type', () => {
    render(<ArtifactPreviewPane {...baseProps} artifactType="mindmap" preview="graph TD" />)
    expect(screen.getByTestId('mindmap')).toBeTruthy()
  })
})
