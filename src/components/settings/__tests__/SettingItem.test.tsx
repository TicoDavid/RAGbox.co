/**
 * Sarah — S-P0-02: SettingItem tests
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import SettingItem from '../SettingItem'

describe('SettingItem', () => {
  it('renders label', () => {
    render(<SettingItem label="Email"><input /></SettingItem>)
    expect(screen.getByText('Email')).toBeTruthy()
  })

  it('renders description when provided', () => {
    render(<SettingItem label="Email" description="Your primary email"><input /></SettingItem>)
    expect(screen.getByText('Your primary email')).toBeTruthy()
  })

  it('does not render description when not provided', () => {
    render(<SettingItem label="Email"><input /></SettingItem>)
    // Only the label text should be present
    const texts = screen.getAllByText(/.+/)
    expect(texts.length).toBe(1)
  })

  it('renders children', () => {
    render(<SettingItem label="Theme"><button>Toggle</button></SettingItem>)
    expect(screen.getByText('Toggle')).toBeTruthy()
  })
})
