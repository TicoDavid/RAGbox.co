/**
 * Sarah — S-P0-02: FeatureGrid tests
 */

import React from 'react'
import { render, screen } from '@testing-library/react'
import FeatureGrid from '../FeatureGrid'

describe('FeatureGrid', () => {
  it('renders section heading', () => {
    render(<FeatureGrid />)
    expect(screen.getByText(/Your Files Speak/)).toBeTruthy()
    expect(screen.getByText(/We Make Them Testify/)).toBeTruthy()
  })

  it('renders 4 feature cards', () => {
    render(<FeatureGrid />)
    expect(screen.getByText('Sovereign Knowledge')).toBeTruthy()
    expect(screen.getByText('10 AI Personas')).toBeTruthy()
    expect(screen.getByText('Sovereign Studio')).toBeTruthy()
    expect(screen.getByText('Mercury Assistant')).toBeTruthy()
  })

  it('renders feature tags', () => {
    render(<FeatureGrid />)
    expect(screen.getByText('Vault + Encryption')).toBeTruthy()
    expect(screen.getByText('CEO to Whistleblower')).toBeTruthy()
    expect(screen.getByText('Reports + Decks')).toBeTruthy()
    expect(screen.getByText('Voice + Chat + Email')).toBeTruthy()
  })

  it('renders subtitle', () => {
    render(<FeatureGrid />)
    expect(screen.getByText(/Analyze your vault like a team of experts/)).toBeTruthy()
  })
})
