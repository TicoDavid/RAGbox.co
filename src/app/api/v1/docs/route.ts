/**
 * RAGbox Public API — Documentation Page
 *
 * GET /api/v1/docs — Returns HTML documentation
 */

import { NextResponse } from 'next/server'

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RAGbox API v1 — Documentation</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; background: #0a192f; color: #e5e7eb; }
    h1 { color: #60a5fa; } h2 { color: #93c5fd; border-bottom: 1px solid #233554; padding-bottom: 0.5rem; margin-top: 2rem; }
    h3 { color: #c0c0c0; } code { background: #112240; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
    pre { background: #112240; padding: 1rem; border-radius: 8px; overflow-x: auto; border: 1px solid #233554; }
    .endpoint { background: #112240; border: 1px solid #233554; border-radius: 8px; padding: 1rem; margin: 1rem 0; }
    .method { font-weight: bold; padding: 2px 8px; border-radius: 4px; font-size: 0.85em; }
    .get { background: #065f46; color: #6ee7b7; } .post { background: #1e3a5f; color: #93c5fd; }
    .delete { background: #7f1d1d; color: #fca5a5; } .patch { background: #78350f; color: #fcd34d; }
    a { color: #60a5fa; }
  </style>
</head>
<body>
  <h1>RAGbox API v1</h1>
  <p>Programmatic access to the RAGbox knowledge platform. Authenticate with an API key.</p>

  <h2>Authentication</h2>
  <p>Include your API key in every request:</p>
  <pre>X-API-Key: rbx_live_your_key_here</pre>
  <p>Or via Authorization header:</p>
  <pre>Authorization: Bearer rbx_live_your_key_here</pre>
  <p>Create API keys from the RAGbox dashboard or via <code>POST /api/v1/keys</code> (session auth).</p>

  <h2>Endpoints</h2>

  <h3>Query</h3>
  <div class="endpoint">
    <p><span class="method post">POST</span> <code>/api/v1/query</code></p>
    <p>Ask a question against your document vault. Returns a cited answer with confidence score.</p>
    <pre>{
  "query": "What is TUMM?",
  "confidenceThreshold": 0.65
}</pre>
    <p><strong>Response:</strong></p>
    <pre>{
  "success": true,
  "data": {
    "answer": "TUMM is the Turing Universal Machine Maker...",
    "confidence": 0.87,
    "citations": [{ "index": 1, "documentId": "...", "documentName": "TUMM Spec", "excerpt": "..." }],
    "silenceProtocol": false
  }
}</pre>
    <p><em>When confidence is below threshold, <code>silenceProtocol: true</code> and <code>answer: null</code>.</em></p>
  </div>

  <h3>Documents</h3>
  <div class="endpoint">
    <p><span class="method get">GET</span> <code>/api/v1/documents?limit=25&amp;offset=0</code></p>
    <p>List your documents with pagination.</p>
  </div>

  <h3>Knowledge Stats</h3>
  <div class="endpoint">
    <p><span class="method get">GET</span> <code>/api/v1/knowledge</code></p>
    <p>Vault statistics: document count, chunk count, query count.</p>
  </div>

  <h3>API Keys (Session Auth Only)</h3>
  <div class="endpoint">
    <p><span class="method get">GET</span> <code>/api/v1/keys</code> — List your API keys</p>
    <p><span class="method post">POST</span> <code>/api/v1/keys</code> — Create a new key</p>
    <p><span class="method delete">DELETE</span> <code>/api/v1/keys?id=key_id</code> — Revoke a key</p>
    <pre>POST /api/v1/keys
{ "name": "My Integration", "scopes": ["read", "write"] }</pre>
  </div>

  <h2>Scopes</h2>
  <table style="width:100%; border-collapse:collapse;">
    <tr style="border-bottom:1px solid #233554;"><th style="text-align:left;padding:8px;">Scope</th><th style="text-align:left;padding:8px;">Permissions</th></tr>
    <tr><td style="padding:8px;"><code>read</code></td><td style="padding:8px;">Query, list documents, view knowledge stats</td></tr>
    <tr><td style="padding:8px;"><code>write</code></td><td style="padding:8px;">Upload documents, update metadata</td></tr>
    <tr><td style="padding:8px;"><code>admin</code></td><td style="padding:8px;">All permissions including key management</td></tr>
  </table>

  <h2>Error Responses</h2>
  <pre>{ "success": false, "error": "Description of what went wrong" }</pre>
  <p>HTTP status codes: 400 (bad request), 401 (unauthorized), 403 (forbidden), 404 (not found), 500 (server error), 502 (upstream error).</p>

  <hr style="border-color:#233554; margin-top:3rem;">
  <p style="color:#64748b; font-size:0.85em;">&copy; 2026 ConnexUS AI Inc. — RAGbox API v1</p>
</body>
</html>`

export async function GET(): Promise<NextResponse> {
  return new NextResponse(HTML, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
