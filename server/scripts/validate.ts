#!/usr/bin/env npx tsx
/**
 * Voice Agent Validation Script - RAGbox.co
 *
 * Quick validation tests for the voice agent system.
 *
 * Usage:
 *   npx tsx server/scripts/validate.ts
 */

import WebSocket from 'ws'

const API_URL = process.env.API_URL || 'http://localhost:3000'
const WS_URL = process.env.WS_URL || 'ws://localhost:3000'

// ============================================================================
// COLORS
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
}

function log(msg: string, color = colors.reset): void {
  console.log(`${color}${msg}${colors.reset}`)
}

function pass(test: string): void {
  log(`  ✓ ${test}`, colors.green)
}

function fail(test: string, error?: string): void {
  log(`  ✗ ${test}`, colors.red)
  if (error) log(`    ${error}`, colors.dim)
}

function section(name: string): void {
  console.log()
  log(`▸ ${name}`, colors.cyan)
}

// ============================================================================
// TEST: Session Bootstrap
// ============================================================================

async function testSessionBootstrap(): Promise<boolean> {
  section('Session Bootstrap')

  try {
    const res = await fetch(`${API_URL}/api/agent/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    if (!res.ok) {
      // 401 is expected without auth
      if (res.status === 401) {
        pass('Endpoint requires authentication (401)')
        return true
      }
      fail(`HTTP ${res.status}`)
      return false
    }

    const data = await res.json()

    // Check required fields
    if (!data.sessionId) {
      fail('Missing sessionId')
      return false
    }
    pass('sessionId present')

    if (!data.wsUrl) {
      fail('Missing wsUrl')
      return false
    }
    pass('wsUrl present')

    if (!data.audio) {
      fail('Missing audio config')
      return false
    }
    pass('audio config present')

    // Check no secrets leaked
    const json = JSON.stringify(data)
    if (json.includes('INWORLD') || json.includes('apiKey') || json.includes('secret')) {
      fail('Response contains secrets!')
      return false
    }
    pass('No secrets in response')

    return true
  } catch (error) {
    fail('Request failed', error instanceof Error ? error.message : String(error))
    return false
  }
}

// ============================================================================
// TEST: WebSocket Handshake
// ============================================================================

async function testWSHandshake(): Promise<boolean> {
  section('WebSocket Handshake')

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      fail('Connection timeout')
      resolve(false)
    }, 5000)

    try {
      const ws = new WebSocket(`${WS_URL}/agent/ws`)

      ws.on('open', () => {
        pass('Connection opened')
        ws.send(JSON.stringify({ type: 'start' }))
      })

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString())
          pass(`Received message: type=${msg.type}`)

          if (msg.type === 'state') {
            pass(`State: ${msg.state}`)
            clearTimeout(timeout)
            ws.close()
            resolve(true)
          }
        } catch {
          pass('Received binary data')
        }
      })

      ws.on('error', (error) => {
        clearTimeout(timeout)
        fail('Connection error', error.message)
        resolve(false)
      })

      ws.on('close', () => {
        clearTimeout(timeout)
      })
    } catch (error) {
      clearTimeout(timeout)
      fail('WebSocket error', error instanceof Error ? error.message : String(error))
      resolve(false)
    }
  })
}

// ============================================================================
// TEST: Tool Registry
// ============================================================================

async function testToolRegistry(): Promise<boolean> {
  section('Tool Registry')

  // Import dynamically to avoid module issues
  try {
    const { executeTool } = await import('../tools')
    const { checkToolPermission } = await import('../tools/permissions')

    // Test permission check
    const adminCtx = { userId: 'test', role: 'Admin' as const, sessionId: 'test', privilegeMode: false }
    const userCtx = { userId: 'test', role: 'User' as const, sessionId: 'test', privilegeMode: false }

    const adminPerm = checkToolPermission('set_viewing_role', adminCtx)
    if (adminPerm.allowed) {
      pass('Admin can access set_viewing_role')
    } else {
      fail('Admin should access set_viewing_role')
      return false
    }

    const userPerm = checkToolPermission('set_viewing_role', userCtx)
    if (!userPerm.allowed) {
      pass('User blocked from set_viewing_role (RBAC)')
    } else {
      fail('User should be blocked from set_viewing_role')
      return false
    }

    // Test tool execution
    const result = await executeTool(
      { id: 'test', name: 'navigate_to', arguments: { destination: 'vault' } },
      userCtx
    )

    if (result.success && result.uiAction?.type === 'navigate') {
      pass('navigate_to returns UI action')
    } else {
      fail('navigate_to failed', result.error)
      return false
    }

    return true
  } catch (error) {
    fail('Module import failed', error instanceof Error ? error.message : String(error))
    return false
  }
}

// ============================================================================
// RUN ALL TESTS
// ============================================================================

async function main(): Promise<void> {
  console.log()
  log('═══════════════════════════════════════════════════════════════', colors.cyan)
  log('  RAGbox Voice Agent - Validation Tests', colors.cyan)
  log('═══════════════════════════════════════════════════════════════', colors.cyan)
  console.log()
  log(`API: ${API_URL}`, colors.dim)
  log(`WS:  ${WS_URL}`, colors.dim)

  const results: boolean[] = []

  results.push(await testSessionBootstrap())
  results.push(await testWSHandshake())
  results.push(await testToolRegistry())

  console.log()
  log('═══════════════════════════════════════════════════════════════', colors.cyan)

  const passed = results.filter(Boolean).length
  const total = results.length

  if (passed === total) {
    log(`  All tests passed (${passed}/${total})`, colors.green)
  } else {
    log(`  ${passed}/${total} tests passed`, colors.yellow)
  }

  log('═══════════════════════════════════════════════════════════════', colors.cyan)
  console.log()

  process.exit(passed === total ? 0 : 1)
}

main().catch(console.error)
