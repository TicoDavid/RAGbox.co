import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// ── Mock next/navigation ────────────────────────────────────────
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/dashboard',
  useSearchParams: () => new URLSearchParams(),
}))

// ── Mock sonner ─────────────────────────────────────────────────
const mockToast = { success: jest.fn(), error: jest.fn() }
jest.mock('sonner', () => ({ toast: mockToast }))

// ── Mock framer-motion ──────────────────────────────────────────
jest.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>, ref: React.Ref<HTMLDivElement>) => {
      const safe: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(props)) {
        if (!['initial', 'animate', 'exit', 'transition', 'variants', 'whileHover', 'whileTap'].includes(k)) {
          safe[k] = v
        }
      }
      return <div ref={ref} {...safe}>{children}</div>
    }),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}))

// ── Mock fetch ──────────────────────────────────────────────────
const CONFIG_RESPONSE = {
  success: true,
  data: {
    config: {
      name: 'Mercury',
      title: 'AI Assistant',
      greeting: 'Welcome to RAGbox.',
      personalityPrompt: 'You are precise.',
      personalityPreset: '',
      rolePreset: '',
      voiceGender: 'female',
      silenceThreshold: 0.60,
      channels: {
        email: { enabled: false },
        whatsapp: { enabled: false },
        voice: { enabled: true },
      },
    },
    presets: {
      professional: 'You are precise.',
      friendly: 'You are warm.',
    },
  },
}

beforeEach(() => {
  jest.clearAllMocks()
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(CONFIG_RESPONSE),
  }) as jest.Mock
})

import { MercurySettingsModal } from '../MercurySettingsModal'

describe('MercurySettingsModal', () => {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    onSaved: jest.fn(),
  }

  it('renders Mercury Settings header when open', async () => {
    render(<MercurySettingsModal {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('Mercury Settings')).toBeInTheDocument()
    })
    expect(screen.getByText('Agent Configuration Engine')).toBeInTheDocument()
  })

  it('renders nothing when closed', () => {
    const { container } = render(<MercurySettingsModal {...defaultProps} open={false} />)
    expect(container.querySelector('[class*="fixed"]')).toBeNull()
  })

  it('renders current section tabs: Identity, Voice, Persona, Silence Protocol', async () => {
    render(<MercurySettingsModal {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('Identity')).toBeInTheDocument()
    })
    expect(screen.getByText('Voice')).toBeInTheDocument()
    expect(screen.getByText('Persona')).toBeInTheDocument()
    expect(screen.getByText('Silence Protocol')).toBeInTheDocument()

    // Old gutted sections should NOT be present
    expect(screen.queryByText('Connections')).not.toBeInTheDocument()
    expect(screen.queryByText('Email')).not.toBeInTheDocument()
    expect(screen.queryByText('WhatsApp')).not.toBeInTheDocument()
    expect(screen.queryByText('Permissions')).not.toBeInTheDocument()
    expect(screen.queryByText('Appearance')).not.toBeInTheDocument()
    expect(screen.queryByText('Alerts')).not.toBeInTheDocument()
    expect(screen.queryByText('Security')).not.toBeInTheDocument()
  })

  it('Voice section is a separate tab with named voice options', async () => {
    render(<MercurySettingsModal {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('Agent Name')).toBeInTheDocument()
    })
    // Switch to Voice tab
    fireEvent.click(screen.getByText('Voice'))
    await waitFor(() => {
      expect(screen.getByText(/Select the voice/)).toBeInTheDocument()
    })
  })

  it('switches sections when nav item is clicked', async () => {
    render(<MercurySettingsModal {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('Agent Name')).toBeInTheDocument()
    })

    // Default section is identity — shows Agent Name field
    expect(screen.getByPlaceholderText('Mercury')).toBeInTheDocument()

    // Click Silence Protocol nav
    fireEvent.click(screen.getByText('Silence Protocol'))
    expect(screen.getByText('Silence Threshold')).toBeInTheDocument()
  })

  it('renders name input with config value', async () => {
    render(<MercurySettingsModal {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByDisplayValue('Mercury')).toBeInTheDocument()
    })
  })

  it('renders silence slider in Silence Protocol section', async () => {
    render(<MercurySettingsModal {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('Agent Name')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Silence Protocol'))
    expect(screen.getByText('Silence Threshold')).toBeInTheDocument()
    expect(screen.getByText('60%')).toBeInTheDocument()
    expect(screen.getByText(/Below this confidence/)).toBeInTheDocument()
  })

  it('save button is disabled when no changes have been made', async () => {
    render(<MercurySettingsModal {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument()
    })
    const saveBtn = screen.getByText('Save Changes').closest('button')!
    expect(saveBtn).toBeDisabled()
  })

  it('save button enables after editing a field', async () => {
    render(<MercurySettingsModal {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByDisplayValue('Mercury')).toBeInTheDocument()
    })

    const nameInput = screen.getByDisplayValue('Mercury')
    fireEvent.change(nameInput, { target: { value: 'Atlas' } })

    const saveBtn = screen.getByText('Save Changes').closest('button')!
    expect(saveBtn).not.toBeDisabled()
  })

  it('calls onClose when close button is clicked', async () => {
    const onClose = jest.fn()
    render(<MercurySettingsModal open={true} onClose={onClose} />)
    await waitFor(() => {
      expect(screen.getByText('Mercury Settings')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByLabelText('Close settings'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when Escape key is pressed', async () => {
    const onClose = jest.fn()
    render(<MercurySettingsModal open={true} onClose={onClose} />)
    await waitFor(() => {
      expect(screen.getByText('Mercury Settings')).toBeInTheDocument()
    })

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('saves config and calls onSaved with updated name', async () => {
    const onSaved = jest.fn()
    ;(global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(CONFIG_RESPONSE) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ success: true }) })

    render(<MercurySettingsModal open={true} onClose={jest.fn()} onSaved={onSaved} />)
    await waitFor(() => {
      expect(screen.getByDisplayValue('Mercury')).toBeInTheDocument()
    })

    // Edit name to make dirty
    const nameInput = screen.getByDisplayValue('Mercury')
    fireEvent.change(nameInput, { target: { value: 'Atlas' } })

    // Click save
    const saveBtn = screen.getByText('Save Changes').closest('button')!
    fireEvent.click(saveBtn)

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith({ name: 'Atlas', title: 'AI Assistant' })
    })
    expect(mockToast.success).toHaveBeenCalledWith('Mercury configuration saved')
  })
})
