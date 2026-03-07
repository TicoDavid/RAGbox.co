#!/usr/bin/env node
/**
 * Capture high-res dashboard screenshots with a forged NextAuth JWT session.
 * Usage: NEXTAUTH_SECRET="..." node scripts/capture-screenshots.mjs
 */
import puppeteer from 'puppeteer'
import { encode } from 'next-auth/jwt'

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || ''
const BASE_URL = 'https://ragbox-app-100739220279.us-east4.run.app'
const USER_ID = '105836695160618550214'
const USER_EMAIL = 'theconnexusai@gmail.com'
const USER_NAME = 'Sheldon'

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  if (!NEXTAUTH_SECRET) {
    console.error('NEXTAUTH_SECRET is required')
    process.exit(1)
  }

  console.log('[1/6] Forging NextAuth JWT...')
  const token = await encode({
    token: {
      id: USER_ID,
      email: USER_EMAIL,
      name: USER_NAME,
      sub: USER_ID,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    secret: NEXTAUTH_SECRET,
    maxAge: 3600,
  })

  console.log('[2/6] Launching browser...')
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080'],
    defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 2 },
  })

  const page = await browser.newPage()

  console.log('[3/6] Setting session cookie...')
  await page.setCookie({
    name: '__Secure-next-auth.session-token',
    value: token,
    domain: 'ragbox-app-100739220279.us-east4.run.app',
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
  })

  console.log('[4/6] Navigating to dashboard...')
  await page.goto(`${BASE_URL}/dashboard`, {
    waitUntil: 'networkidle2',
    timeout: 45000,
  })
  await sleep(5000)

  const url = page.url()
  console.log('  URL:', url)
  if (!url.includes('/dashboard')) {
    console.log('  Auth failed')
    await page.screenshot({ path: 'screenshots/00_auth_failed.png' })
    await browser.close()
    return
  }

  // Dismiss the Getting Started checklist by clicking its close (X) button
  console.log('  Dismissing onboarding checklist...')
  try {
    await page.evaluate(() => {
      // Find the "Getting Started" text, then find the close button nearby
      const allText = document.querySelectorAll('*')
      for (const el of allText) {
        if (el.textContent?.trim() === 'Getting Started' && el.childNodes.length <= 2) {
          // Find sibling or parent close button
          const parent = el.closest('div')
          if (parent) {
            const closeBtn = parent.querySelector('button') || parent.parentElement?.querySelector('button')
            if (closeBtn) {
              closeBtn.click()
              return true
            }
          }
        }
      }
      // Fallback: click any X/close button in bottom-right area
      const buttons = document.querySelectorAll('button')
      for (const btn of buttons) {
        const rect = btn.getBoundingClientRect()
        if (rect.right > window.innerWidth - 400 && rect.bottom > window.innerHeight - 300) {
          const svg = btn.querySelector('svg')
          if (svg && btn.textContent?.trim() === '') {
            btn.click()
            return true
          }
        }
      }
      return false
    })
    await sleep(1000)
  } catch (_) {}

  // Step 5: Open vault panel and take screenshot
  console.log('[5/6] Opening vault panel for document list...')
  const vaultBtn = await page.$('button[aria-label="Vault"]')
  if (vaultBtn) {
    await vaultBtn.click()
    await sleep(3000)
  }

  await page.screenshot({ path: 'screenshots/02_legal_vault.png' })
  console.log('  Saved: screenshots/02_legal_vault.png')

  // Step 6: Send query and capture answer with citations
  console.log('[6/6] Sending NDA termination query...')

  // Find and type in chat input
  const inputEl = await page.evaluateHandle(() => {
    return document.querySelector('textarea') ||
      document.querySelector('input[placeholder*="Ask"]') ||
      document.querySelector('input[placeholder*="ask"]') ||
      document.querySelector('input[placeholder*="Mercury"]') ||
      document.querySelector('input[placeholder*="mercury"]') ||
      document.querySelector('input[placeholder*="message"]')
  })

  const el = inputEl.asElement()
  if (el) {
    await el.click()
    await sleep(300)
    await el.type('What are the termination conditions in the Mutual NDA?', { delay: 20 })
    await sleep(300)
    await page.keyboard.press('Enter')

    // Wait for SSE streaming to complete
    console.log('  Waiting 40s for response...')
    await sleep(40000)

    // Scroll chat to bottom
    await page.evaluate(() => {
      document.querySelectorAll('[class*="overflow"]').forEach(el => {
        el.scrollTop = el.scrollHeight
      })
    })
    await sleep(1000)

    await page.screenshot({ path: 'screenshots/01_nda_answer_citations.png' })
    console.log('  Saved: screenshots/01_nda_answer_citations.png')
  } else {
    console.log('  Chat input not found')
    await page.screenshot({ path: 'screenshots/01_no_input.png' })
  }

  await browser.close()
  console.log('\nDone!')
}

main().catch(e => {
  console.error('Fatal:', e.message)
  process.exit(1)
})
