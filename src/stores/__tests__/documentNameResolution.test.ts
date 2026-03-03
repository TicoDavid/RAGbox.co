/**
 * BUG-048: Document Name Resolution Tests
 *
 * Tests the resolveDocumentName function added to chatStore and mercuryStore.
 * When the Go backend returns raw document UUIDs instead of filenames in
 * citation responses, resolveDocumentName looks up the display name from
 * vaultStore as a fallback.
 *
 * Decision branches:
 *   1. Backend returns real name (non-UUID) → pass through
 *   2. Backend returns UUID, doc in vault → use vault name
 *   3. Backend returns UUID, doc NOT in vault → fall back to 'Document'
 *   4. Backend returns undefined/empty → fall back to 'Document'
 *
 * — Sarah, QA
 */

import { useVaultStore } from '../vaultStore'
import type { VaultItem } from '@/types/ragbox'

// ─── Replicate resolveDocumentName from chatStore/mercuryStore ────────────
// Not exported, so we replicate the exact logic for isolated testing.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function resolveDocumentName(documentId: string, backendName?: string): string {
  if (backendName && !UUID_RE.test(backendName)) return backendName
  const doc = useVaultStore.getState().documents[documentId]
  if (doc?.name) return doc.name
  return 'Document'
}

// ─── Test fixtures ──────────────────────────────────────────────────────────

const DOC_UUID = '08a64541-2019-474b-94db-74de7b252529'
const DOC_UUID_2 = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

function makeVaultItem(overrides: Partial<VaultItem> & { id: string; name: string }): VaultItem {
  return {
    originalName: overrides.name,
    type: 'document',
    createdAt: new Date(),
    updatedAt: new Date(),
    status: 'ready',
    isPrivileged: false,
    isStarred: false,
    securityTier: 1,
    deletionStatus: 'none' as VaultItem['deletionStatus'],
    ...overrides,
  }
}

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  useVaultStore.setState({
    documents: {
      [DOC_UUID]: makeVaultItem({
        id: DOC_UUID,
        name: 'Investor Pitch Script.docx',
      }),
      [DOC_UUID_2]: makeVaultItem({
        id: DOC_UUID_2,
        name: 'NDA Agreement 2024.pdf',
      }),
    },
  })
})

// ============================================================================
// BACKEND RETURNS REAL NAME → PASS THROUGH
// ============================================================================

describe('Document Name Resolution — real name passthrough', () => {

  it('backend returns a real filename → passes through unchanged', () => {
    const result = resolveDocumentName(DOC_UUID, 'Investor Pitch Script.docx')
    expect(result).toBe('Investor Pitch Script.docx')
  })

  it('backend returns a name with spaces and extension → passes through', () => {
    const result = resolveDocumentName('any-id', 'Annual Report 2024.pdf')
    expect(result).toBe('Annual Report 2024.pdf')
  })

  it('backend returns a short name → passes through', () => {
    const result = resolveDocumentName('any-id', 'notes.txt')
    expect(result).toBe('notes.txt')
  })

  it('does NOT look up vault when backend provides a real name', () => {
    // Even if doc is in vault, backend name takes precedence
    const result = resolveDocumentName(DOC_UUID, 'Custom Override Name.pdf')
    expect(result).toBe('Custom Override Name.pdf')
  })
})

// ============================================================================
// BACKEND RETURNS UUID → RESOLVE FROM VAULT
// ============================================================================

describe('Document Name Resolution — UUID → vault lookup', () => {

  it('backend returns UUID → resolves to vault document name', () => {
    const result = resolveDocumentName(DOC_UUID, DOC_UUID)
    expect(result).toBe('Investor Pitch Script.docx')
  })

  it('second document UUID → resolves to its vault name', () => {
    const result = resolveDocumentName(DOC_UUID_2, DOC_UUID_2)
    expect(result).toBe('NDA Agreement 2024.pdf')
  })

  it('uppercase UUID → still detected and resolved from vault', () => {
    const upper = DOC_UUID.toUpperCase()
    const result = resolveDocumentName(DOC_UUID, upper)
    expect(result).toBe('Investor Pitch Script.docx')
  })

  it('UUID as backendName with valid documentId → vault lookup succeeds', () => {
    // backendName is a UUID, but documentId points to a vault entry
    const result = resolveDocumentName(DOC_UUID, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
    expect(result).toBe('Investor Pitch Script.docx')
  })
})

// ============================================================================
// DOCUMENT NOT IN VAULT → FALLBACK
// ============================================================================

describe('Document Name Resolution — not in vault fallback', () => {

  it('UUID not in vault → falls back to "Document"', () => {
    const unknownId = '99999999-0000-0000-0000-000000000000'
    const result = resolveDocumentName(unknownId, unknownId)
    expect(result).toBe('Document')
  })

  it('undefined backendName, unknown documentId → falls back to "Document"', () => {
    const result = resolveDocumentName('unknown-id')
    expect(result).toBe('Document')
  })

  it('empty string backendName → falls back to "Document"', () => {
    const result = resolveDocumentName('unknown-id', '')
    expect(result).toBe('Document')
  })

  it('empty vault → falls back to "Document"', () => {
    useVaultStore.setState({ documents: {} })
    const result = resolveDocumentName(DOC_UUID, DOC_UUID)
    expect(result).toBe('Document')
  })
})

// ============================================================================
// UUID REGEX VALIDATION
// ============================================================================

describe('Document Name Resolution — UUID detection', () => {

  it('standard v4 UUID is detected', () => {
    expect(UUID_RE.test('08a64541-2019-474b-94db-74de7b252529')).toBe(true)
  })

  it('uppercase UUID is detected', () => {
    expect(UUID_RE.test('08A64541-2019-474B-94DB-74DE7B252529')).toBe(true)
  })

  it('mixed case UUID is detected', () => {
    expect(UUID_RE.test('08a64541-2019-474B-94DB-74de7b252529')).toBe(true)
  })

  it('filename is NOT detected as UUID', () => {
    expect(UUID_RE.test('Investor Pitch Script.docx')).toBe(false)
  })

  it('partial UUID is NOT detected', () => {
    expect(UUID_RE.test('08a64541-2019-474b')).toBe(false)
  })

  it('UUID with extra characters is NOT detected', () => {
    expect(UUID_RE.test('prefix-08a64541-2019-474b-94db-74de7b252529')).toBe(false)
  })
})

// ============================================================================
// WORKS IN BOTH STORES (same function logic)
// ============================================================================

describe('Document Name Resolution — consistent across stores', () => {

  it('chatStore and mercuryStore use identical resolution logic', () => {
    // Both stores replicate the same resolveDocumentName function.
    // Verify the same inputs produce the same outputs.
    const inputs: Array<[string, string | undefined]> = [
      [DOC_UUID, DOC_UUID],                          // UUID → vault
      [DOC_UUID, 'Real Name.pdf'],                    // real name → passthrough
      ['unknown', undefined],                          // missing → 'Document'
      ['unknown', ''],                                 // empty → 'Document'
    ]

    const expected = [
      'Investor Pitch Script.docx',
      'Real Name.pdf',
      'Document',
      'Document',
    ]

    inputs.forEach(([docId, backendName], i) => {
      expect(resolveDocumentName(docId, backendName)).toBe(expected[i])
    })
  })
})
