/**
 * TASK 1: Preset Key Persistence Tests — EPIC-010
 *
 * Verifies that personalityPreset + rolePreset columns round-trip
 * correctly through POST → GET /api/mercury/config.
 *
 * — Sarah, Engineering
 */
export {} // Ensure this file is treated as a module (avoids TS2451 conflict with Next.js route types)

// ── Mock next-auth/jwt ───────────────────────────────────────────
jest.mock('next-auth/jwt', () => ({
  getToken: jest.fn().mockResolvedValue({
    id: 'user-1',
    email: 'test@ragbox.co',
  }),
}))

// ── Mock Prisma ──────────────────────────────────────────────────
let storedPersona: Record<string, unknown> = {}

const DEFAULT_PERSONA = {
  firstName: 'Mercury',
  lastName: '',
  title: 'AI Assistant',
  personalityPrompt: 'You are precise, citation-focused, and formal.',
  personalityPreset: null,
  rolePreset: null,
  voiceId: 'en-US-Neural2-F',
  silenceHighThreshold: 0.60,
  channelConfig: {},
  emailEnabled: false,
  emailAddress: null,
  greeting: 'Welcome to RAGbox.',
}

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    mercuryPersona: {
      findUnique: jest.fn(() => Promise.resolve({ ...DEFAULT_PERSONA, ...storedPersona })),
      upsert: jest.fn((args: { update: Record<string, unknown> }) => {
        // Merge update into stored state (simulates DB upsert)
        storedPersona = { ...storedPersona, ...args.update }
        return Promise.resolve({ ...DEFAULT_PERSONA, ...storedPersona })
      }),
      create: jest.fn(() => Promise.resolve({ ...DEFAULT_PERSONA })),
    },
  },
}))

// ── Import route handlers ────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-require-imports
const routeHandlers = require('../config/route')
const GET = routeHandlers.GET as (req: Request) => Promise<Response>
const POST = routeHandlers.POST as (req: Request) => Promise<Response>

// ── Helpers ──────────────────────────────────────────────────────

function makePostRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/mercury/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function makeGetRequest(): Request {
  return new Request('http://localhost:3000/api/mercury/config', { method: 'GET' })
}

async function postAndGetConfig(body: Record<string, unknown>) {
  const postRes = await POST(makePostRequest(body))
  expect(postRes.status).toBe(200)

  const getRes = await GET(makeGetRequest())
  const json = await getRes.json()
  return json.data.config
}

// ── Setup ────────────────────────────────────────────────────────

beforeEach(() => {
  storedPersona = {}
})

// ── Tests ────────────────────────────────────────────────────────

describe('Preset Key Persistence', () => {
  it('POST with personalityPreset="ceo" → GET returns personalityPreset="ceo"', async () => {
    const config = await postAndGetConfig({
      name: 'Mercury',
      personalityPreset: 'ceo',
    })

    expect(config.personalityPreset).toBe('ceo')
  })

  it('POST with rolePreset="legal" → GET returns rolePreset="legal"', async () => {
    const config = await postAndGetConfig({
      name: 'Mercury',
      rolePreset: 'legal',
    })

    expect(config.rolePreset).toBe('legal')
  })

  it('POST with personalityPreset="ceo" + custom personalityPrompt → both stored', async () => {
    const config = await postAndGetConfig({
      name: 'Mercury',
      personalityPreset: 'ceo',
      personalityPrompt: 'Custom override instructions for CEO briefing.',
    })

    expect(config.personalityPreset).toBe('ceo')
    // personalityPrompt should be the resolved CEO preset (since preset takes priority)
    expect(config.personalityPrompt).toContain('Chief Executive Officer')
  })

  it('POST without preset keys → GET returns empty strings (backward compatible)', async () => {
    const config = await postAndGetConfig({
      name: 'Mercury',
      greeting: 'Updated greeting.',
    })

    // Should default to empty string (not null or undefined)
    expect(config.personalityPreset).toBe('')
    expect(config.rolePreset).toBe('')
  })

  it('change preset from "ceo" to "professional" → GET returns "professional"', async () => {
    // First save as CEO
    await POST(makePostRequest({
      name: 'Mercury',
      personalityPreset: 'ceo',
    }))

    // Verify CEO is stored
    let getRes = await GET(makeGetRequest())
    let json = await getRes.json()
    expect(json.data.config.personalityPreset).toBe('ceo')

    // Change to professional
    await POST(makePostRequest({
      name: 'Mercury',
      personalityPreset: 'professional',
    }))

    // Verify professional now
    getRes = await GET(makeGetRequest())
    json = await getRes.json()
    expect(json.data.config.personalityPreset).toBe('professional')
  })
})
