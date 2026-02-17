/**
 * Admin Migration Endpoint
 * POST /api/admin/migrate — Run pending migrations via Cloud Run (which has DB access)
 * Protected by internal auth secret.
 */

import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

const INTERNAL_AUTH_SECRET = process.env.INTERNAL_AUTH_SECRET || ''

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Only allow internal auth
  const authHeader = request.headers.get('x-internal-auth') || ''
  if (!INTERNAL_AUTH_SECRET || authHeader !== INTERNAL_AUTH_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: string[] = []

  try {
    // Mercury Personas table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS mercury_personas (
          id UUID NOT NULL DEFAULT gen_random_uuid(),
          tenant_id TEXT NOT NULL,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL DEFAULT '',
          title TEXT DEFAULT 'AI Assistant',
          personality_prompt TEXT NOT NULL,
          voice_id TEXT,
          avatar_url TEXT,
          greeting TEXT,
          signature_block TEXT,
          silence_high_threshold DOUBLE PRECISION NOT NULL DEFAULT 0.85,
          silence_med_threshold DOUBLE PRECISION NOT NULL DEFAULT 0.70,
          channel_config JSONB NOT NULL DEFAULT '{}',
          is_active BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT mercury_personas_pkey PRIMARY KEY (id)
      )
    `)
    results.push('mercury_personas table: OK')

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS mercury_personas_tenant_id_key ON mercury_personas(tenant_id)
    `)
    results.push('mercury_personas unique index: OK')

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS mercury_personas_tenant_id_idx ON mercury_personas(tenant_id)
    `)
    results.push('mercury_personas index: OK')

    await prisma.$executeRawUnsafe(`
      INSERT INTO mercury_personas (tenant_id, first_name, last_name, title, personality_prompt, greeting)
      VALUES (
          'default',
          'M.E.R.C.U.R.Y.',
          '',
          'AI Assistant',
          'You are M.E.R.C.U.R.Y., an AI assistant powered by RAGbox. You answer questions based on documents in the user vault. Always cite your sources. If you are not confident, invoke the Silence Protocol.',
          'Welcome to RAGbox. I am M.E.R.C.U.R.Y., your AI assistant. Upload documents to your vault and ask me anything about them.'
      )
      ON CONFLICT (tenant_id) DO NOTHING
    `)
    results.push('default persona seed: OK')

    return NextResponse.json({ success: true, results })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Migration failed',
      results,
    }, { status: 500 })
  }
}
