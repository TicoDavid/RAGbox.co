/**
 * Sarah — S-P0-02: MarkdownRenderer tests
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import { MarkdownRenderer } from '../MarkdownRenderer'

describe('MarkdownRenderer', () => {
  it('renders markdown content', () => {
    render(<MarkdownRenderer content="Hello world" />)
    expect(screen.getByText('Hello world')).toBeTruthy()
  })

  it('renders inside react-markdown mock', () => {
    render(<MarkdownRenderer content="test content" />)
    expect(screen.getByTestId('react-markdown')).toBeTruthy()
  })

  it('does not show TL;DR for short content', () => {
    render(<MarkdownRenderer content="Short answer." />)
    expect(screen.queryByText('TL;DR')).toBeNull()
  })

  it('shows TL;DR summary for content over 300 words', () => {
    const longContent = Array(350).fill('word').join(' ')
    render(<MarkdownRenderer content={longContent} />)
    expect(screen.getByText('TL;DR')).toBeTruthy()
  })
})
