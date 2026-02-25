import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { proxyToBackend } from '@/lib/backend-proxy'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

/**
 * MCP Server Endpoint for ConnexUS Integration
 *
 * Allows external systems (V-Reps, ATHENA, PROTEUS) to query RAGbox
 * knowledge bases via a standardized MCP tool interface.
 *
 * POST /api/mcp — tools/list, tools/call, resources/list
 * GET  /api/mcp — server info
 */
export async function POST(request: NextRequest) {
  // STORY-S03: Require authenticated session
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { method, params } = body

    switch (method) {
      case 'tools/list':
        return NextResponse.json({
          tools: [
            {
              name: 'ragbox_query',
              description: 'Query a RAGbox knowledge base with natural language. Returns cited answers with confidence scores.',
              inputSchema: {
                type: 'object',
                properties: {
                  query: { type: 'string', description: 'Natural language question' },
                  vaultId: { type: 'string', description: 'Optional vault ID to scope the query' },
                  privilegeMode: { type: 'boolean', description: 'Include privileged documents', default: false },
                  mode: { type: 'string', enum: ['concise', 'detailed', 'risk-analysis'], default: 'concise' },
                },
                required: ['query'],
              },
            },
            {
              name: 'ragbox_health',
              description: 'Run a health check on a RAGbox vault. Returns freshness and coverage status.',
              inputSchema: {
                type: 'object',
                properties: {
                  vaultId: { type: 'string', description: 'Vault ID to check' },
                },
                required: ['vaultId'],
              },
            },
            {
              name: 'ragbox_gaps',
              description: 'List open content gaps (queries that RAGbox could not answer).',
              inputSchema: {
                type: 'object',
                properties: {
                  limit: { type: 'number', description: 'Max results', default: 10 },
                },
              },
            },
          ],
        })

      case 'tools/call': {
        const { name, arguments: args } = params || {}

        if (name === 'ragbox_query') {
          return proxyToBackend(
            new NextRequest(request.url, {
              method: 'POST',
              headers: request.headers,
              body: JSON.stringify({
                query: args.query,
                privilegeMode: args.privilegeMode ?? false,
                mode: args.mode ?? 'concise',
              }),
            }),
            { backendPath: '/api/chat' }
          )
        }

        if (name === 'ragbox_health') {
          return proxyToBackend(
            new NextRequest(request.url, {
              method: 'POST',
              headers: request.headers,
            }),
            { backendPath: `/api/vaults/${args.vaultId}/health-check` }
          )
        }

        if (name === 'ragbox_gaps') {
          return proxyToBackend(
            new NextRequest(request.url, {
              method: 'GET',
              headers: request.headers,
            }),
            { backendPath: `/api/content-gaps?limit=${args?.limit ?? 10}` }
          )
        }

        return NextResponse.json({ error: `Unknown tool: ${name}` }, { status: 400 })
      }

      case 'resources/list': {
        // EPIC-017 S04: Wire to actual Vault document listing (authenticated, tenant-scoped)
        const userId = session.user.id || session.user.email || ''

        try {
          const vaults = await prisma.vault.findMany({
            where: { userId },
            select: {
              id: true,
              name: true,
              documents: {
                where: { deletionStatus: 'Active' },
                select: {
                  id: true,
                  originalName: true,
                  mimeType: true,
                  filename: true,
                },
                orderBy: { createdAt: 'desc' },
              },
            },
            orderBy: { updatedAt: 'desc' },
          })

          const resources = vaults.flatMap((vault) =>
            vault.documents.map((doc) => ({
              uri: `ragbox://vault/${vault.id}/document/${doc.id}`,
              name: doc.originalName || doc.filename,
              mimeType: doc.mimeType,
              description: `Document in vault "${vault.name}"`,
            }))
          )

          return NextResponse.json({ resources })
        } catch (err) {
          logger.error('[MCP] resources/list failed:', err)
          return NextResponse.json({ resources: [] })
        }
      }

      default:
        return NextResponse.json({ error: `Unknown method: ${method}` }, { status: 400 })
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET() {
  // STORY-S03: Require authenticated session
  const getSession = await getServerSession(authOptions)
  if (!getSession?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    name: 'ragbox-mcp',
    version: '1.0.0',
    description: 'RAGbox.co MCP Server — Sovereign document intelligence for ConnexUS AI',
    capabilities: {
      tools: true,
      resources: true,
    },
  })
}
