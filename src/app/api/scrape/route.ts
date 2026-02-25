/**
 * Quick URL Scraper API - RAGbox.co
 *
 * POST /api/scrape - Scrape content from a URL for ad-hoc context injection
 */

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { validateExternalUrl } from '@/lib/utils/url-validation'

export async function POST(request: NextRequest): Promise<NextResponse> {
  // STORY-S03: Require authenticated session
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // SSRF protection: validate URL scheme, block private/internal IPs
    const validation = validateExternalUrl(url)
    if (!validation.ok) {
      const status = validation.reason.includes('internal') ? 403 : 400
      return NextResponse.json({ error: validation.reason }, { status })
    }

    // Fetch the URL content
    const response = await fetch(validation.url.href, {
      headers: {
        'User-Agent': 'RAGbox/1.0 (Knowledge Extraction Bot)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${response.status}` },
        { status: 502 }
      )
    }

    const contentType = response.headers.get('content-type') || ''
    let content = ''

    if (contentType.includes('text/html')) {
      const html = await response.text()
      // Basic HTML stripping - extract text content
      content = html
        // Remove script and style tags with content
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        // Remove HTML comments
        .replace(/<!--[\s\S]*?-->/g, '')
        // Remove all HTML tags
        .replace(/<[^>]+>/g, ' ')
        // Decode common HTML entities
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        .trim()
    } else if (contentType.includes('text/plain') || contentType.includes('application/json')) {
      content = await response.text()
    } else {
      return NextResponse.json(
        { error: 'Unsupported content type. Only HTML, plain text, and JSON are supported.' },
        { status: 415 }
      )
    }

    // Truncate to reasonable size for context window
    const maxLength = 8000
    if (content.length > maxLength) {
      content = content.slice(0, maxLength) + '\n\n[Content truncated...]'
    }

    return NextResponse.json({
      url,
      content,
      contentType,
      length: content.length,
      truncated: content.length >= maxLength,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Request timed out' }, { status: 504 })
    }

    return NextResponse.json(
      { error: 'Failed to scrape URL' },
      { status: 500 }
    )
  }
}
