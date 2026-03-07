/**
 * Sarah — S-P0-02: CyGraphPanels tests
 */

import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return {
    Sparkles: icon('sparkles'),
    ArrowRight: icon('arrow-right'),
    Loader2: icon('loader'),
    Network: icon('network'),
  }
})

import { ClaimsPanel, RelationshipsPanel } from '../CyGraphPanels'
import type { CyGraphClaim, CyGraphEdge } from '../CyGraphPanels'

describe('ClaimsPanel', () => {
  it('shows loading spinner when loading', () => {
    render(<ClaimsPanel claims={[]} loading={true} />)
    expect(screen.getByTestId('icon-loader')).toBeTruthy()
  })

  it('shows empty state when no claims', () => {
    render(<ClaimsPanel claims={[]} loading={false} />)
    expect(screen.getByText('Knowledge graph building...')).toBeTruthy()
  })

  it('renders claim subject, predicate, and object', () => {
    const claims: CyGraphClaim[] = [
      { id: 'c1', subjectEntity: 'Acme Corp', predicate: 'OWNS', objectValue: 'Patent 123', confidence: 0.9 },
    ]
    render(<ClaimsPanel claims={claims} loading={false} />)
    expect(screen.getByText('Acme Corp')).toBeTruthy()
    expect(screen.getByText('OWNS')).toBeTruthy()
    expect(screen.getByText('Patent 123')).toBeTruthy()
  })

  it('renders confidence percentage', () => {
    const claims: CyGraphClaim[] = [
      { id: 'c1', subjectEntity: 'X', predicate: 'IS', objectValue: 'Y', confidence: 0.87 },
    ]
    render(<ClaimsPanel claims={claims} loading={false} />)
    expect(screen.getByText('87%')).toBeTruthy()
  })
})

describe('RelationshipsPanel', () => {
  it('shows loading spinner when loading', () => {
    render(<RelationshipsPanel edges={[]} loading={true} />)
    expect(screen.getByTestId('icon-loader')).toBeTruthy()
  })

  it('shows empty state when no edges', () => {
    render(<RelationshipsPanel edges={[]} loading={false} />)
    expect(screen.getByText('No entity relationships extracted yet.')).toBeTruthy()
  })

  it('renders relationship entities and type', () => {
    const edges: CyGraphEdge[] = [
      { fromEntity: 'Alice', toEntity: 'Bob', relationType: 'WORKS_WITH', weight: 0.8 },
    ]
    render(<RelationshipsPanel edges={edges} loading={false} />)
    expect(screen.getByText('Alice')).toBeTruthy()
    expect(screen.getByText('WORKS_WITH')).toBeTruthy()
    expect(screen.getByText('Bob')).toBeTruthy()
    expect(screen.getByText('80%')).toBeTruthy()
  })

  it('groups edges by source entity', () => {
    const edges: CyGraphEdge[] = [
      { fromEntity: 'Alice', toEntity: 'Bob', relationType: 'KNOWS', weight: 0.9 },
      { fromEntity: 'Alice', toEntity: 'Charlie', relationType: 'MANAGES', weight: 0.7 },
    ]
    render(<RelationshipsPanel edges={edges} loading={false} />)
    expect(screen.getByText('Bob')).toBeTruthy()
    expect(screen.getByText('Charlie')).toBeTruthy()
  })
})
