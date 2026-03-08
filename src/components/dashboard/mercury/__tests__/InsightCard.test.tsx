/**
 * Jordan — EPIC-028 Phase 4: InsightCard tests (updated for rich InsightData)
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

const mockAcknowledge = jest.fn()
const mockNavigate = jest.fn()

jest.mock('lucide-react', () => ({
  Calendar: (props: React.ComponentProps<'svg'>) => <svg data-testid="icon-calendar" {...props} />,
  FileText: (props: React.ComponentProps<'svg'>) => <svg data-testid="icon-filetext" {...props} />,
  AlertTriangle: (props: React.ComponentProps<'svg'>) => <svg data-testid="icon-alert" {...props} />,
  TrendingUp: (props: React.ComponentProps<'svg'>) => <svg data-testid="icon-trend" {...props} />,
  CheckCircle: (props: React.ComponentProps<'svg'>) => <svg data-testid="icon-check" {...props} />,
  X: (props: React.ComponentProps<'svg'>) => <svg data-testid="icon-x" {...props} />,
  ExternalLink: (props: React.ComponentProps<'svg'>) => <svg data-testid="icon-external" {...props} />,
}))

import { InsightCard } from '../InsightCard'
import type { InsightData } from '@/stores/mercuryStore'

function makeInsight(overrides: Partial<InsightData> = {}): InsightData {
  return {
    id: 'ins-1',
    insightType: 'reminder',
    title: 'Test Insight',
    summary: 'A pattern was detected',
    relevanceScore: 0.8,
    acknowledged: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('InsightCard', () => {
  beforeEach(() => jest.clearAllMocks())

  it('renders insight title and summary', () => {
    render(
      <InsightCard insight={makeInsight()} onAcknowledge={mockAcknowledge} />
    )
    expect(screen.getByText('Test Insight')).toBeTruthy()
    expect(screen.getByText('A pattern was detected')).toBeTruthy()
  })

  it('calls onAcknowledge with id on dismiss click', () => {
    render(
      <InsightCard insight={makeInsight({ id: 'ins-42' })} onAcknowledge={mockAcknowledge} />
    )
    fireEvent.click(screen.getByLabelText('Dismiss insight'))
    expect(mockAcknowledge).toHaveBeenCalledWith('ins-42')
  })

  it('calls onNavigate when documentId is present and card is clicked', () => {
    render(
      <InsightCard
        insight={makeInsight({ documentId: 'doc-1' })}
        onAcknowledge={mockAcknowledge}
        onNavigate={mockNavigate}
      />
    )
    fireEvent.click(screen.getByText('Test Insight'))
    expect(mockNavigate).toHaveBeenCalledWith('doc-1')
  })
})
