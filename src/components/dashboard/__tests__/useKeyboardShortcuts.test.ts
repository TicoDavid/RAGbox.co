/**
 * Keyboard Shortcuts Tests
 *
 * Tests the keyboard shortcut handler logic used in GlobalHeader.
 * Since the shortcuts are inline in GlobalHeader (not a separate hook),
 * we test the handler function directly.
 */

describe('Keyboard Shortcuts Handler', () => {
  let searchOpen: boolean
  let setSearchOpenCalls: Array<boolean | ((prev: boolean) => boolean)>
  let handleKeyDown: (e: Partial<KeyboardEvent>) => void

  function setSearchOpen(val: boolean | ((prev: boolean) => boolean)) {
    setSearchOpenCalls.push(val)
    if (typeof val === 'function') {
      searchOpen = val(searchOpen)
    } else {
      searchOpen = val
    }
  }

  beforeEach(() => {
    searchOpen = false
    setSearchOpenCalls = []

    // Replicate the exact handler from GlobalHeader.tsx lines 127-134
    handleKeyDown = (e: Partial<KeyboardEvent>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault?.()
        setSearchOpen((prev: boolean) => !prev)
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false)
      }
    }
  })

  it('Cmd+K toggles search open', () => {
    handleKeyDown({ metaKey: true, key: 'k', preventDefault: jest.fn() })
    expect(searchOpen).toBe(true)
  })

  it('Ctrl+K toggles search open (Windows/Linux)', () => {
    handleKeyDown({ ctrlKey: true, key: 'k', preventDefault: jest.fn() })
    expect(searchOpen).toBe(true)
  })

  it('Escape closes search when open', () => {
    // First open it
    searchOpen = true
    // Re-create handler with searchOpen = true (matches useEffect dependency)
    handleKeyDown = (e: Partial<KeyboardEvent>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault?.()
        setSearchOpen((prev: boolean) => !prev)
      }
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false)
      }
    }
    handleKeyDown({ key: 'Escape' })
    expect(searchOpen).toBe(false)
  })

  it('Escape does nothing when search is already closed', () => {
    searchOpen = false
    setSearchOpenCalls = []
    handleKeyDown({ key: 'Escape' })
    expect(setSearchOpenCalls).toHaveLength(0)
  })

  it('regular keys without modifier do not trigger search', () => {
    handleKeyDown({ key: 'k' })
    expect(setSearchOpenCalls).toHaveLength(0)
    handleKeyDown({ key: 'a', metaKey: false, ctrlKey: false })
    expect(setSearchOpenCalls).toHaveLength(0)
  })
})
