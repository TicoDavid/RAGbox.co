/**
 * Sarah — S-P0-02: DocContent tests
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { DocContent } from '../DocContent'

describe('DocContent', () => {
  it('renders content via ReactMarkdown mock', () => {
    render(<DocContent content="Hello World" />)
    expect(screen.getByTestId('react-markdown')).toBeTruthy()
    expect(screen.getByText('Hello World')).toBeTruthy()
  })

  it('renders with different content', () => {
    render(<DocContent content="# Getting Started" />)
    expect(screen.getByText('# Getting Started')).toBeTruthy()
  })
})
