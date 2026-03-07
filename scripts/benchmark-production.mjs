#!/usr/bin/env node
/**
 * Production TTFB benchmark — Vertex AI vs OpenRouter (Gemini 2.5 Flash + DeepSeek V3.2)
 *
 * Creates a valid NextAuth JWE session token and calls the production /api/chat
 * endpoint with BYOLLM fields. The Next.js route auto-injects the tenant's
 * encrypted OpenRouter API key.
 *
 * Usage:
 *   NEXTAUTH_SECRET=... USER_ID=... node scripts/benchmark-production.mjs
 *
 * Or with secrets from GCP:
 *   export NEXTAUTH_SECRET=$(gcloud secrets versions access latest --secret=nextauth-secret --project=ragbox-sovereign-prod)
 *   export USER_ID=105836695160618550214
 *   node scripts/benchmark-production.mjs
 */

import hkdf from '@panva/hkdf'
import { EncryptJWT } from 'jose'
import { v4 as uuid } from 'uuid'
import { readFileSync } from 'fs'

const APP_URL = process.env.APP_URL || 'https://app.ragbox.co'
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || readFileSync('/tmp/.nextauth-secret', 'utf8').trim()
const USER_ID = process.env.USER_ID || '105836695160618550214'

if (!NEXTAUTH_SECRET) {
  console.error('ERROR: NEXTAUTH_SECRET required')
  process.exit(1)
}

// --- NextAuth JWE token creation ---

async function getDerivedEncryptionKey(secret, salt = '') {
  return await hkdf(
    'sha256', secret, salt,
    `NextAuth.js Generated Encryption Key${salt ? ` (${salt})` : ''}`,
    32
  )
}

async function createSessionToken() {
  const encryptionSecret = await getDerivedEncryptionKey(NEXTAUTH_SECRET)
  const now = Math.floor(Date.now() / 1000)

  const token = {
    sub: USER_ID,
    id: USER_ID,
    name: 'Benchmark',
    email: 'benchmark@ragbox.co',
    iat: now,
  }

  return await new EncryptJWT(token)
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(now + 3600) // 1 hour
    .setJti(uuid())
    .encrypt(encryptionSecret)
}

// --- Benchmark queries ---

const queries = [
  { id: 1, query: 'What is the effective date?', category: 'simple' },
  { id: 2, query: 'Who are the parties to this agreement?', category: 'simple' },
  { id: 3, query: 'What is the termination notice period?', category: 'simple' },
  { id: 4, query: 'Summarize all the obligations of the service provider', category: 'complex' },
  { id: 5, query: 'What happens if both parties disagree on liability?', category: 'complex' },
  { id: 6, query: 'Compare the warranty terms with the limitation of liability', category: 'complex' },
  { id: 7, query: 'What does Section 4.2 say?', category: 'keyword' },
  { id: 8, query: 'The Provider shall maintain insurance coverage of no less than one million dollars', category: 'keyword' },
  { id: 9, query: 'What is the effective date?', category: 'cache-repeat' },
  { id: 10, query: 'Summarize all the obligations of the service provider', category: 'cache-repeat' },
]

const providers = [
  { name: 'Vertex AI (AEGIS)', llmProvider: '', llmModel: '' },
  { name: 'OpenRouter Gemini', llmProvider: 'openrouter', llmModel: 'google/gemini-2.5-flash' },
  { name: 'OpenRouter DeepSeek', llmProvider: 'openrouter', llmModel: 'deepseek/deepseek-chat-v3-0324' },
]

// --- Benchmark runner ---

async function runBenchmark(sessionToken, provider, query) {
  const body = {
    query: query.query,
    stream: true,
    useVectorPipeline: true,
    privilegeMode: false,
    maxTier: 3,
    safetyMode: true,
    history: [],
  }

  // BYOLLM routing — don't set for AEGIS (Vertex AI default)
  if (provider.llmProvider) {
    body.llmProvider = provider.llmProvider
    body.llmModel = provider.llmModel
  }

  const start = performance.now()
  let ttfbMs = 0
  let totalMs = 0
  let tokenCount = 0
  let error = ''
  let firstToken = true

  try {
    const res = await fetch(`${APP_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      error = `HTTP ${res.status}: ${text.slice(0, 200)}`
      totalMs = Math.round(performance.now() - start)
      return { queryId: query.id, provider: provider.name, ttfbMs, totalMs, tokenCount, error }
    }

    const contentType = res.headers.get('content-type') || ''

    if (contentType.includes('application/json')) {
      // Non-streaming response (cached or fallback)
      const json = await res.json()
      ttfbMs = Math.round(performance.now() - start)
      totalMs = ttfbMs
      const answer = json.data?.answer || json.answer || json.response || ''
      tokenCount = answer.split(/\s+/).filter(Boolean).length
      return { queryId: query.id, provider: provider.name, ttfbMs, totalMs, tokenCount, error }
    }

    // SSE streaming response
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const messages = buffer.split('\n\n')
      buffer = messages.pop() || ''

      for (const msg of messages) {
        if (!msg.trim()) continue

        let eventType = ''
        let eventData = ''
        for (const line of msg.split('\n')) {
          if (line.startsWith('event: ')) eventType = line.slice(7).trim()
          else if (line.startsWith('data: ')) eventData = line.slice(6)
        }

        if (!eventData) continue

        // Count tokens from: token events, silence events, done events
        if (eventType === 'token') {
          if (firstToken) {
            ttfbMs = Math.round(performance.now() - start)
            firstToken = false
          }
          try {
            const data = JSON.parse(eventData)
            if (data.text) tokenCount += data.text.split(/\s+/).filter(Boolean).length
          } catch {}
        } else if (eventType === 'done') {
          // If no tokens streamed, get TTFB from done event
          if (firstToken) {
            ttfbMs = Math.round(performance.now() - start)
            firstToken = false
          }
          try {
            const data = JSON.parse(eventData)
            const d = data.data || data
            if (d.answer && tokenCount === 0) {
              tokenCount = d.answer.split(/\s+/).filter(Boolean).length
            }
          } catch {}
        } else if (eventType === 'silence') {
          if (firstToken) {
            ttfbMs = Math.round(performance.now() - start)
            firstToken = false
          }
          try {
            const data = JSON.parse(eventData)
            if (data.message) tokenCount += data.message.split(/\s+/).filter(Boolean).length
          } catch {}
        }
      }
    }

    totalMs = Math.round(performance.now() - start)
    if (firstToken) error = 'no response events'
  } catch (e) {
    error = e.message || String(e)
    totalMs = Math.round(performance.now() - start)
  }

  return { queryId: query.id, provider: provider.name, ttfbMs, totalMs, tokenCount, error }
}

// --- Main ---

async function main() {
  console.error('Creating NextAuth session token...')
  const sessionToken = await createSessionToken()
  console.error('Session token created. Testing auth...')

  // Quick auth check
  const testRes = await fetch(`${APP_URL}/api/documents?limit=1`, {
    headers: { 'Authorization': `Bearer ${sessionToken}` },
  })
  if (!testRes.ok) {
    console.error(`Auth check failed: HTTP ${testRes.status}`)
    const body = await testRes.text().catch(() => '')
    console.error(body.slice(0, 500))
    process.exit(1)
  }
  console.error('Auth OK. Starting benchmark...\n')

  const results = []

  for (const q of queries) {
    console.error(`  [${q.id}/${queries.length}] "${q.query.slice(0, 50)}${q.query.length > 50 ? '...' : ''}"`)

    for (const p of providers) {
      let r = await runBenchmark(sessionToken, p, q)

      // Retry once on 429 after a longer backoff
      if (r.error && r.error.includes('429')) {
        console.error(`    ${p.name}: 429 — retrying in 10s...`)
        await new Promise(resolve => setTimeout(resolve, 10000))
        r = await runBenchmark(sessionToken, p, q)
      }

      results.push(r)

      if (r.error) {
        console.error(`    ${p.name}: ERROR — ${r.error.slice(0, 100)}`)
      } else {
        console.error(`    ${p.name}: TTFB=${r.ttfbMs}ms  Total=${r.totalMs}ms  Tokens=${r.tokenCount}`)
      }

      // Pause between providers (longer to avoid rate limits)
      await new Promise(resolve => setTimeout(resolve, 5000))
    }

    // Pause between queries
    await new Promise(resolve => setTimeout(resolve, 3000))
  }

  // --- Generate report ---
  printReport(results)
}

function printReport(results) {
  const now = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'

  console.log('# Model Routing Benchmark: Gemini 2.5 Flash + DeepSeek V3.2')
  console.log()
  console.log(`**Date:** ${now}`)
  console.log('**Models:** Gemini 2.5 Flash (Vertex AI + OpenRouter), DeepSeek V3.2 (OpenRouter)')
  console.log('**Engineer:** Sheldon (Chief Engineer)')
  console.log()
  console.log('---')
  console.log()

  // Per-query table
  console.log('## Per-Query Results')
  console.log()
  console.log('| # | Category | Query | AEGIS TTFB | OR Gemini TTFB | OR DeepSeek TTFB | AEGIS Total | OR Gemini Total | OR DeepSeek Total | TTFB Winner |')
  console.log('|---|----------|-------|------------|----------------|------------------|-------------|-----------------|-------------------|-------------|')

  for (const q of queries) {
    const aegis = results.find(r => r.queryId === q.id && r.provider === 'Vertex AI (AEGIS)')
    const orGemini = results.find(r => r.queryId === q.id && r.provider === 'OpenRouter Gemini')
    const orDeepSeek = results.find(r => r.queryId === q.id && r.provider === 'OpenRouter DeepSeek')

    const fmtMs = (r) => r?.error ? 'ERROR' : `${r?.ttfbMs || 0}ms`
    const fmtTotal = (r) => r?.error ? 'ERROR' : `${r?.totalMs || 0}ms`

    // Find winner (lowest TTFB among non-errored)
    const candidates = [
      { name: 'AEGIS', ttfb: aegis?.error ? Infinity : (aegis?.ttfbMs ?? Infinity) },
      { name: 'OR Gemini', ttfb: orGemini?.error ? Infinity : (orGemini?.ttfbMs ?? Infinity) },
      { name: 'OR DeepSeek', ttfb: orDeepSeek?.error ? Infinity : (orDeepSeek?.ttfbMs ?? Infinity) },
    ].filter(c => c.ttfb < Infinity).sort((a, b) => a.ttfb - b.ttfb)

    const winner = candidates.length > 0 ? candidates[0].name : '—'

    const truncQ = q.query.length > 40 ? q.query.slice(0, 37) + '...' : q.query

    console.log(`| ${q.id} | ${q.category} | ${truncQ} | ${fmtMs(aegis)} | ${fmtMs(orGemini)} | ${fmtMs(orDeepSeek)} | ${fmtTotal(aegis)} | ${fmtTotal(orGemini)} | ${fmtTotal(orDeepSeek)} | ${winner} |`)
  }

  console.log()
  console.log('---')
  console.log()

  // Summary
  console.log('## Summary Statistics')
  console.log()

  for (const pName of ['Vertex AI (AEGIS)', 'OpenRouter Gemini', 'OpenRouter DeepSeek']) {
    const pResults = results.filter(r => r.provider === pName && !r.error)
    const ttfbs = pResults.map(r => r.ttfbMs).sort((a, b) => a - b)
    const totals = pResults.map(r => r.totalMs).sort((a, b) => a - b)
    const errors = results.filter(r => r.provider === pName && r.error).length

    console.log(`### ${pName}`)
    console.log()
    if (ttfbs.length === 0) {
      console.log(`All ${errors} queries failed.`)
    } else {
      const avg = Math.round(ttfbs.reduce((a, b) => a + b, 0) / ttfbs.length)
      const p50 = ttfbs[Math.floor(ttfbs.length * 0.5)]
      const p95 = ttfbs[Math.min(Math.ceil(ttfbs.length * 0.95) - 1, ttfbs.length - 1)]
      const min = ttfbs[0]
      const max = ttfbs[ttfbs.length - 1]
      const avgTotal = Math.round(totals.reduce((a, b) => a + b, 0) / totals.length)

      console.log('| Metric | Value |')
      console.log('|--------|-------|')
      console.log(`| Avg TTFB | **${avg}ms** |`)
      console.log(`| P50 TTFB | ${p50}ms |`)
      console.log(`| P95 TTFB | ${p95}ms |`)
      console.log(`| Min TTFB | ${min}ms |`)
      console.log(`| Max TTFB | ${max}ms |`)
      console.log(`| Avg Total | ${avgTotal}ms |`)
      console.log(`| Errors | ${errors}/${queries.length} |`)
    }
    console.log()
  }

  console.log('---')
  console.log()

  // Recommendation
  console.log('## Recommendation')
  console.log()

  const providerStats = ['Vertex AI (AEGIS)', 'OpenRouter Gemini', 'OpenRouter DeepSeek'].map(pName => {
    const pResults = results.filter(r => r.provider === pName && !r.error)
    const ttfbs = pResults.map(r => r.ttfbMs)
    const avg = ttfbs.length > 0 ? Math.round(ttfbs.reduce((a, b) => a + b, 0) / ttfbs.length) : null
    const errors = results.filter(r => r.provider === pName && r.error).length
    return { name: pName, avg, errors, count: ttfbs.length }
  })

  const working = providerStats.filter(p => p.avg !== null && p.errors <= 2)
  if (working.length === 0) {
    console.log('All providers had significant errors. Manual investigation needed.')
  } else {
    working.sort((a, b) => a.avg - b.avg)
    const best = working[0]
    const others = working.slice(1)

    console.log(`**Fastest: ${best.name}** at ${best.avg}ms avg TTFB.`)
    console.log()
    for (const other of others) {
      const diff = other.avg - best.avg
      const pct = Math.round((diff / other.avg) * 100)
      console.log(`- ${other.name}: ${other.avg}ms avg TTFB (+${diff}ms, ${pct}% slower)`)
    }
  }

  console.log()
  console.log('---')
  console.log()
  console.log('— Sheldon, Chief Engineer')
}

main().catch(err => {
  console.error('FATAL:', err)
  process.exit(1)
})
