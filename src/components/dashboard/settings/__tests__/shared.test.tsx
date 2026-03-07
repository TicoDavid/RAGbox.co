/**
 * Sarah — S-P0-02: shared settings primitives tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { SectionHeader, ToggleSetting } from '../shared'

describe('SectionHeader', () => {
  it('renders title', () => {
    render(<SectionHeader title="Appearance" description="Customize your look" />)
    expect(screen.getByText('Appearance')).toBeTruthy()
  })

  it('renders description', () => {
    render(<SectionHeader title="T" description="My description" />)
    expect(screen.getByText('My description')).toBeTruthy()
  })
})

describe('ToggleSetting', () => {
  it('renders label and description', () => {
    render(<ToggleSetting label="Dark Mode" description="Enable dark theme" enabled={false} onToggle={jest.fn()} />)
    expect(screen.getByText('Dark Mode')).toBeTruthy()
    expect(screen.getByText('Enable dark theme')).toBeTruthy()
  })

  it('renders switch role', () => {
    render(<ToggleSetting label="Notify" description="desc" enabled={true} onToggle={jest.fn()} />)
    const sw = screen.getByRole('switch')
    expect(sw.getAttribute('aria-checked')).toBe('true')
  })

  it('calls onToggle when switch clicked', () => {
    const onToggle = jest.fn()
    render(<ToggleSetting label="X" description="d" enabled={false} onToggle={onToggle} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onToggle).toHaveBeenCalled()
  })
})
