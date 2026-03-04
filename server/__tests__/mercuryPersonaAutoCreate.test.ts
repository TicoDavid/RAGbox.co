/**
 * MercuryPersona Auto-Create Tests
 *
 * Tests that GET /api/mercury/config auto-creates a MercuryPersona record
 * with correct defaults on first login. Replicates the auto-create logic
 * from src/app/api/mercury/config/route.ts for isolated testing.
 *
 * Decision branches:
 *   1. No persona exists → create with defaults
 *   2. Persona already exists → return existing, do NOT overwrite
 *   3. Defaults: firstName='Mercury', lastName='', title='AI Assistant',
 *      greeting='Welcome to RAGbox...', personalityPrompt=professional preset
 *   4. Multiple tenants → each gets own persona
 *
 * — Sarah, QA
 */

// ─── Types matching Prisma MercuryPersona schema ─────────────────────────────

interface MercuryPersona {
  tenantId: string
  firstName: string
  lastName: string
  title: string
  greeting: string
  personalityPrompt: string
  voiceId: string | null
}

// ─── Replicate auto-create logic from route.ts ───────────────────────────────

const PROFESSIONAL_PRESET =
  'You are a professional AI assistant. Provide formal, precise, citation-backed responses.'

const DEFAULT_GREETING =
  'Welcome to RAGbox. Upload documents to your vault and ask me anything about them.'

/** In-memory persona store simulating Prisma findUnique + create */
class PersonaStore {
  private store = new Map<string, MercuryPersona>()

  findUnique(tenantId: string): MercuryPersona | null {
    return this.store.get(tenantId) ?? null
  }

  create(tenantId: string, data: Partial<MercuryPersona> = {}): MercuryPersona {
    const persona: MercuryPersona = {
      tenantId,
      firstName: data.firstName ?? 'Mercury',
      lastName: data.lastName ?? '',
      title: data.title ?? 'AI Assistant',
      greeting: data.greeting ?? DEFAULT_GREETING,
      personalityPrompt: data.personalityPrompt ?? PROFESSIONAL_PRESET,
      voiceId: data.voiceId ?? null,
    }
    this.store.set(tenantId, persona)
    return persona
  }

  /** Replicate the GET handler auto-create logic */
  getOrCreate(tenantId: string): MercuryPersona {
    const existing = this.findUnique(tenantId)
    if (existing) return existing
    return this.create(tenantId)
  }

  clear() {
    this.store.clear()
  }
}

// ─── Test fixtures ───────────────────────────────────────────────────────────

const TENANT_A = 'tenant-001'
const TENANT_B = 'tenant-002'

let store: PersonaStore

beforeEach(() => {
  store = new PersonaStore()
})

// ============================================================================
// AUTO-CREATE ON FIRST LOGIN
// ============================================================================

describe('MercuryPersona Auto-Create — first login defaults', () => {
  it('creates persona when none exists', () => {
    expect(store.findUnique(TENANT_A)).toBeNull()
    const persona = store.getOrCreate(TENANT_A)
    expect(persona).not.toBeNull()
    expect(persona.tenantId).toBe(TENANT_A)
  })

  it('sets firstName to "Mercury"', () => {
    const persona = store.getOrCreate(TENANT_A)
    expect(persona.firstName).toBe('Mercury')
  })

  it('sets lastName to empty string', () => {
    const persona = store.getOrCreate(TENANT_A)
    expect(persona.lastName).toBe('')
  })

  it('sets title to "AI Assistant"', () => {
    const persona = store.getOrCreate(TENANT_A)
    expect(persona.title).toBe('AI Assistant')
  })

  it('sets greeting to default welcome message', () => {
    const persona = store.getOrCreate(TENANT_A)
    expect(persona.greeting).toBe(DEFAULT_GREETING)
  })

  it('sets personalityPrompt to professional preset', () => {
    const persona = store.getOrCreate(TENANT_A)
    expect(persona.personalityPrompt).toBe(PROFESSIONAL_PRESET)
  })

  it('sets voiceId to null', () => {
    const persona = store.getOrCreate(TENANT_A)
    expect(persona.voiceId).toBeNull()
  })
})

// ============================================================================
// EXISTING USERS NOT AFFECTED
// ============================================================================

describe('MercuryPersona Auto-Create — existing users unaffected', () => {
  it('returns existing persona without overwriting', () => {
    store.create(TENANT_A, {
      firstName: 'Evelyn',
      lastName: 'Hayes',
      title: 'Custom Agent',
      greeting: 'Hey there!',
      personalityPrompt: 'Be casual and friendly.',
      voiceId: 'Ashley',
    })

    const persona = store.getOrCreate(TENANT_A)
    expect(persona.firstName).toBe('Evelyn')
    expect(persona.lastName).toBe('Hayes')
    expect(persona.title).toBe('Custom Agent')
    expect(persona.greeting).toBe('Hey there!')
    expect(persona.personalityPrompt).toBe('Be casual and friendly.')
    expect(persona.voiceId).toBe('Ashley')
  })

  it('does not create a second record for the same tenant', () => {
    store.create(TENANT_A, { firstName: 'Evelyn' })
    const first = store.getOrCreate(TENANT_A)
    const second = store.getOrCreate(TENANT_A)
    expect(first).toEqual(second)
    expect(first.firstName).toBe('Evelyn')
  })

  it('calling getOrCreate twice returns identical objects', () => {
    const a = store.getOrCreate(TENANT_A)
    const b = store.getOrCreate(TENANT_A)
    expect(a).toEqual(b)
  })
})

// ============================================================================
// MULTI-TENANT ISOLATION
// ============================================================================

describe('MercuryPersona Auto-Create — multi-tenant isolation', () => {
  it('creates separate personas for different tenants', () => {
    const a = store.getOrCreate(TENANT_A)
    const b = store.getOrCreate(TENANT_B)
    expect(a.tenantId).toBe(TENANT_A)
    expect(b.tenantId).toBe(TENANT_B)
    expect(a.tenantId).not.toBe(b.tenantId)
  })

  it('customizing one tenant does not affect another', () => {
    store.create(TENANT_A, { firstName: 'Evelyn', voiceId: 'Ashley' })
    const b = store.getOrCreate(TENANT_B)
    expect(b.firstName).toBe('Mercury')
    expect(b.voiceId).toBeNull()
  })
})

// ============================================================================
// SETTINGS READ/WRITE AFTER AUTO-CREATE
// ============================================================================

describe('MercuryPersona — Settings accessible after auto-create', () => {
  it('persona is retrievable immediately after auto-create', () => {
    store.getOrCreate(TENANT_A)
    const found = store.findUnique(TENANT_A)
    expect(found).not.toBeNull()
    expect(found!.firstName).toBe('Mercury')
  })

  it('greeting field is non-empty after auto-create', () => {
    const persona = store.getOrCreate(TENANT_A)
    expect(persona.greeting.length).toBeGreaterThan(0)
  })

  it('personalityPrompt field is non-empty after auto-create', () => {
    const persona = store.getOrCreate(TENANT_A)
    expect(persona.personalityPrompt.length).toBeGreaterThan(0)
  })
})
