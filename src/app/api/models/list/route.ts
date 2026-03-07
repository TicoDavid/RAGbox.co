import { NextResponse } from 'next/server'
import { MODEL_CATALOG } from '@/lib/models/catalog'

/**
 * GET /api/models/list — returns the curated per-provider model catalog.
 *
 * Supports env override via AVAILABLE_MODELS (JSON string of provider→model[] map).
 * Falls back to the built-in catalog from src/lib/models/catalog.ts.
 */
export async function GET() {
  // Check for env override
  const envModels = process.env.AVAILABLE_MODELS
  if (envModels) {
    try {
      const parsed = JSON.parse(envModels)
      return NextResponse.json({ data: parsed })
    } catch {
      // Invalid JSON — fall through to built-in catalog
    }
  }

  // Return built-in catalog
  return NextResponse.json({ data: MODEL_CATALOG })
}
