/**
 * WhatsApp Provider Factory - RAGbox.co
 *
 * Reads WHATSAPP_PROVIDER env var and returns a cached singleton.
 * Default: 'vonage' (sandbox-ready for demo).
 */

import type { WhatsAppProvider } from './types'
import { VonageProvider } from './vonage'
import { MetaProvider } from './meta'

let cachedProvider: WhatsAppProvider | null = null

export function getWhatsAppProvider(): WhatsAppProvider {
  if (cachedProvider) return cachedProvider

  const providerName = (process.env.WHATSAPP_PROVIDER || 'vonage').toLowerCase()

  switch (providerName) {
    case 'vonage':
      cachedProvider = new VonageProvider()
      break
    case 'meta':
      cachedProvider = new MetaProvider()
      break
    default:
      throw new Error(`Unknown WhatsApp provider: ${providerName}. Use 'vonage' or 'meta'.`)
  }

  console.log(`[WhatsApp] Provider initialized: ${cachedProvider.name}`)
  return cachedProvider
}

/** Reset cached provider (for testing) */
export function resetProvider(): void {
  cachedProvider = null
}
