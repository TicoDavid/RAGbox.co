/**
 * Sarah — S-P0-02: ContentArea tests
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    (props: React.ComponentProps<'svg'>) => <svg data-testid={`icon-${name}`} {...props} />
  return { List: icon('list'), Grid: icon('grid') }
})

jest.mock('../ListView', () => {
  return (props: { documents: unknown[] }) => <div data-testid="list-view">{(props.documents as unknown[]).length} docs</div>
})

jest.mock('../GridView', () => {
  return (props: { documents: unknown[] }) => <div data-testid="grid-view">{(props.documents as unknown[]).length} docs</div>
})

import ContentArea from '../ContentArea'

describe('ContentArea', () => {
  it('shows document count', () => {
    render(<ContentArea documents={[{} as never, {} as never]} onSelectDocument={jest.fn()} onDeleteDocument={jest.fn()} />)
    expect(screen.getByText('2 documents')).toBeTruthy()
  })

  it('renders list view by default', () => {
    render(<ContentArea documents={[]} onSelectDocument={jest.fn()} onDeleteDocument={jest.fn()} />)
    expect(screen.getByTestId('list-view')).toBeTruthy()
  })

  it('switches to grid view', () => {
    render(<ContentArea documents={[]} onSelectDocument={jest.fn()} onDeleteDocument={jest.fn()} />)
    fireEvent.click(screen.getByLabelText('Grid view'))
    expect(screen.getByTestId('grid-view')).toBeTruthy()
  })

  it('has list/grid toggle buttons', () => {
    render(<ContentArea documents={[]} onSelectDocument={jest.fn()} onDeleteDocument={jest.fn()} />)
    expect(screen.getByLabelText('List view')).toBeTruthy()
    expect(screen.getByLabelText('Grid view')).toBeTruthy()
  })
})
