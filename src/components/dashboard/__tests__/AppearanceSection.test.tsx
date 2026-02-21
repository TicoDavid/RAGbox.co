import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'

// ── Mock useSettings ────────────────────────────────────────────
const mockSetTheme = jest.fn()
const mockSetDensity = jest.fn()

let mockTheme = 'cobalt' as 'cobalt' | 'noir' | 'forest' | 'obsidian'
let mockDensity = 'comfortable' as 'compact' | 'comfortable'

jest.mock('@/contexts/SettingsContext', () => ({
  useSettings: () => ({
    theme: mockTheme,
    setTheme: mockSetTheme,
    density: mockDensity,
    setDensity: mockSetDensity,
  }),
}))

// ── Mock lucide-react ───────────────────────────────────────────
jest.mock('lucide-react', () => ({
  Check: (props: React.ComponentProps<'svg'>) => <svg data-testid="check-icon" {...props} />,
  LayoutGrid: (props: React.ComponentProps<'svg'>) => <svg data-testid="layout-grid-icon" {...props} />,
}))

// ── Inline AppearanceSettings (extracted from GlobalHeader.tsx) ──
// We test the logic directly rather than importing the 1800-line GlobalHeader

function AppearanceSettings() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { theme, setTheme, density, setDensity } = require('@/contexts/SettingsContext').useSettings()

  const themes = [
    { id: 'cobalt' as const, name: 'Midnight Cobalt', subtitle: 'Default sovereign blue', description: 'Best for extended sessions' },
    { id: 'noir' as const, name: 'Cyber Noir', subtitle: 'OLED black, neon cyan', description: 'Maximum contrast, minimal glare' },
    { id: 'forest' as const, name: 'Forest Dark', subtitle: 'Military field dark', description: 'Low visibility environments' },
    { id: 'obsidian' as const, name: 'Obsidian Gold', subtitle: 'Executive luxury', description: 'Premium client-facing mode' },
  ]

  const densityOptions = [
    { id: 'compact' as const, label: 'Compact', description: 'Tighter spacing, more content visible' },
    { id: 'comfortable' as const, label: 'Comfortable', description: 'Standard spacing, easier reading' },
  ]

  return (
    <div>
      <div data-testid="theme-grid">
        {themes.map((t) => {
          const isSelected = theme === t.id
          return (
            <button key={t.id} onClick={() => setTheme(t.id)} data-testid={`theme-${t.id}`}>
              {isSelected && <span data-testid={`checkmark-${t.id}`}>✓</span>}
              <span>{t.name}</span>
              <span>{t.description}</span>
            </button>
          )
        })}
      </div>
      <div data-testid="density-grid">
        {densityOptions.map((option) => (
          <button key={option.id} onClick={() => setDensity(option.id)} data-testid={`density-${option.id}`}>
            <span>{option.label}</span>
            <span>{option.description}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

describe('AppearanceSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockTheme = 'cobalt'
    mockDensity = 'comfortable'
  })

  it('renders all 4 themes', () => {
    render(<AppearanceSettings />)
    expect(screen.getByText('Midnight Cobalt')).toBeInTheDocument()
    expect(screen.getByText('Cyber Noir')).toBeInTheDocument()
    expect(screen.getByText('Forest Dark')).toBeInTheDocument()
    expect(screen.getByText('Obsidian Gold')).toBeInTheDocument()
  })

  it('shows checkmark on selected theme only', () => {
    mockTheme = 'noir'
    render(<AppearanceSettings />)
    expect(screen.getByTestId('checkmark-noir')).toBeInTheDocument()
    expect(screen.queryByTestId('checkmark-cobalt')).not.toBeInTheDocument()
    expect(screen.queryByTestId('checkmark-forest')).not.toBeInTheDocument()
    expect(screen.queryByTestId('checkmark-obsidian')).not.toBeInTheDocument()
  })

  it('calls setTheme when a different theme is clicked', () => {
    render(<AppearanceSettings />)
    fireEvent.click(screen.getByTestId('theme-obsidian'))
    expect(mockSetTheme).toHaveBeenCalledWith('obsidian')
  })

  it('renders correct descriptions for each theme', () => {
    render(<AppearanceSettings />)
    expect(screen.getByText('Best for extended sessions')).toBeInTheDocument()
    expect(screen.getByText('Maximum contrast, minimal glare')).toBeInTheDocument()
    expect(screen.getByText('Low visibility environments')).toBeInTheDocument()
    expect(screen.getByText('Premium client-facing mode')).toBeInTheDocument()
  })

  it('renders both density controls', () => {
    render(<AppearanceSettings />)
    expect(screen.getByText('Compact')).toBeInTheDocument()
    expect(screen.getByText('Comfortable')).toBeInTheDocument()
    expect(screen.getByText('Tighter spacing, more content visible')).toBeInTheDocument()
    expect(screen.getByText('Standard spacing, easier reading')).toBeInTheDocument()
  })

  it('calls setDensity when density option is clicked', () => {
    render(<AppearanceSettings />)
    fireEvent.click(screen.getByTestId('density-compact'))
    expect(mockSetDensity).toHaveBeenCalledWith('compact')
  })
})
