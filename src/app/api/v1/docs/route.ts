/**
 * RAGbox Public API -- Documentation Page
 *
 * GET /api/v1/docs -- Returns comprehensive HTML documentation
 */

import { NextResponse } from 'next/server'

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>RAGbox API v1 -- Reference</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0a192f;--bg2:#112240;--bg3:#1B2D4B;--bg4:#233554;--text:#e5e7eb;--text2:#c0c0c0;--text3:#94a3b8;--blue:#2463EB;--blue2:#60a5fa;--border:#233554;--green:#10b981;--red:#ef4444;--amber:#f59e0b;--font:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;--mono:'JetBrains Mono',Menlo,Consolas,monospace}
body{font-family:var(--font);background:var(--bg);color:var(--text);line-height:1.6;display:flex;min-height:100vh}
a{color:var(--blue2);text-decoration:none}a:hover{text-decoration:underline}

/* Sidebar */
.sidebar{width:260px;background:var(--bg2);border-right:1px solid var(--border);position:fixed;top:0;left:0;bottom:0;overflow-y:auto;padding:1.5rem 0;z-index:10}
.sidebar h2{padding:0 1.25rem;font-size:1.1rem;color:var(--blue2);margin-bottom:1rem;display:flex;align-items:center;gap:.5rem}
.sidebar .logo{font-weight:700;font-size:1.2rem;color:#fff;padding:0 1.25rem .75rem;border-bottom:1px solid var(--border);margin-bottom:1rem}
.sidebar .logo span{color:var(--blue2)}
.nav-group{margin-bottom:.5rem}
.nav-group-title{font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text3);padding:.5rem 1.25rem .25rem;font-weight:600}
.nav-link{display:block;padding:.35rem 1.25rem .35rem 1.75rem;color:var(--text2);font-size:.85rem;transition:background .15s,color .15s;border-left:2px solid transparent}
.nav-link:hover{background:var(--bg3);color:#fff;text-decoration:none}
.nav-link.active{border-left-color:var(--blue);color:var(--blue2);background:rgba(36,99,235,.08)}

/* Main */
main{margin-left:260px;flex:1;padding:2.5rem 3rem 4rem;max-width:900px}
h1{font-size:2rem;color:#fff;margin-bottom:.25rem}
h2{font-size:1.5rem;color:var(--blue2);margin-top:3rem;margin-bottom:1rem;padding-bottom:.5rem;border-bottom:1px solid var(--border)}
h3{font-size:1.15rem;color:var(--text);margin-top:1.5rem;margin-bottom:.5rem}
p{margin-bottom:.75rem;color:var(--text2)}
.version{display:inline-block;background:var(--blue);color:#fff;font-size:.75rem;padding:2px 10px;border-radius:999px;margin-left:.5rem;vertical-align:middle}

/* Method badges */
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:.8rem;font-weight:700;font-family:var(--mono);margin-right:.5rem}
.badge-get{background:#065f46;color:#6ee7b7}
.badge-post{background:#1e3a5f;color:#93c5fd}
.badge-delete{background:#7f1d1d;color:#fca5a5}
.badge-patch{background:#78350f;color:#fcd34d}

/* Endpoint cards */
.endpoint{background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:1rem 1.25rem;margin:1rem 0}
.endpoint-header{font-family:var(--mono);font-size:.9rem;margin-bottom:.5rem;display:flex;align-items:center}
.endpoint-header code{background:none;padding:0;color:var(--text)}
.param-table{width:100%;border-collapse:collapse;margin:.75rem 0;font-size:.85rem}
.param-table th{text-align:left;padding:6px 10px;background:var(--bg3);color:var(--text3);font-weight:600;border:1px solid var(--border)}
.param-table td{padding:6px 10px;border:1px solid var(--border);color:var(--text2)}
.param-table code{font-size:.8rem}

/* Code blocks */
pre{position:relative;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:1rem;overflow-x:auto;margin:.75rem 0;font-size:.85rem;line-height:1.5}
pre code{font-family:var(--mono);color:var(--text2);background:none;padding:0}
code{background:var(--bg3);padding:2px 6px;border-radius:4px;font-size:.85em;font-family:var(--mono)}
.copy-btn{position:absolute;top:8px;right:8px;background:var(--bg3);color:var(--text3);border:1px solid var(--border);padding:3px 10px;border-radius:4px;cursor:pointer;font-size:.75rem;transition:all .15s}
.copy-btn:hover{background:var(--bg4);color:#fff}

/* Tables */
table:not(.param-table){width:100%;border-collapse:collapse;margin:.75rem 0;font-size:.9rem}
table:not(.param-table) th{text-align:left;padding:8px 12px;background:var(--bg3);color:var(--text3);border-bottom:2px solid var(--border)}
table:not(.param-table) td{padding:8px 12px;border-bottom:1px solid var(--border);color:var(--text2)}

/* Responsive */
@media(max-width:900px){
  .sidebar{display:none}
  main{margin-left:0;padding:1.5rem}
}
</style>
</head>
<body>

<nav class="sidebar">
  <div class="logo">RAG<span>box</span></div>
  <div class="nav-group">
    <div class="nav-group-title">Getting Started</div>
    <a class="nav-link" href="#quick-start">Quick Start</a>
    <a class="nav-link" href="#authentication">Authentication</a>
    <a class="nav-link" href="#rate-limits">Rate Limits</a>
  </div>
  <div class="nav-group">
    <div class="nav-group-title">Endpoints</div>
    <a class="nav-link" href="#documents">Documents</a>
    <a class="nav-link" href="#rag-query">RAG Query</a>
    <a class="nav-link" href="#knowledge">Knowledge</a>
    <a class="nav-link" href="#api-keys">API Keys</a>
    <a class="nav-link" href="#mcp">MCP</a>
    <a class="nav-link" href="#mercury">Mercury Chat</a>
    <a class="nav-link" href="#webhooks">Webhooks</a>
    <a class="nav-link" href="#audit">Audit</a>
    <a class="nav-link" href="#health">Health</a>
  </div>
  <div class="nav-group">
    <div class="nav-group-title">Reference</div>
    <a class="nav-link" href="#errors">Error Responses</a>
    <a class="nav-link" href="#security">Security</a>
    <a class="nav-link" href="#sdks">SDK Examples</a>
  </div>
</nav>

<main>

<!-- Header -->
<h1>RAGbox API Reference <span class="version">v1.0</span></h1>
<p>Programmatic access to the RAGbox knowledge platform. Upload documents, query your vault, and manage your workspace.</p>

<!-- Quick Start -->
<h2 id="quick-start">Quick Start</h2>
<p>Upload a document and query it in two requests:</p>
<pre><button class="copy-btn" onclick="copyCode(this)">Copy</button><code># Upload a document
curl -X POST https://app.ragbox.co/api/v1/documents \\
  -H "X-API-Key: rbx_live_YOUR_KEY" \\
  -F "file=@contract.pdf" \\
  -F "title=Service Agreement"

# Query your vault
curl -X POST https://app.ragbox.co/api/v1/query \\
  -H "X-API-Key: rbx_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "What are the termination clauses?"}'</code></pre>

<!-- Authentication -->
<h2 id="authentication">Authentication</h2>
<p>Include your API key in every request via the <code>X-API-Key</code> header:</p>
<pre><button class="copy-btn" onclick="copyCode(this)">Copy</button><code>X-API-Key: rbx_live_your_key_here</code></pre>
<p>Keys use the format <code>rbx_live_</code> followed by 64 hexadecimal characters. Create keys from the <strong>Settings &rarr; API Keys</strong> page in the dashboard or via <code>POST /api/v1/keys</code>.</p>

<!-- Rate Limits -->
<h2 id="rate-limits">Rate Limits</h2>
<table>
  <tr><th>Endpoint Category</th><th>Limit</th><th>Window</th></tr>
  <tr><td>General API</td><td>60 requests</td><td>1 minute</td></tr>
  <tr><td>RAG Query</td><td>10 requests</td><td>1 minute</td></tr>
  <tr><td>Document Upload</td><td>5 requests</td><td>1 minute</td></tr>
  <tr><td>Knowledge Forge</td><td>5 requests</td><td>1 minute</td></tr>
</table>
<p>Rate-limited responses return <code>429 Too Many Requests</code> with a <code>Retry-After</code> header (seconds).</p>

<!-- Documents -->
<h2 id="documents">Documents</h2>

<div class="endpoint">
  <div class="endpoint-header"><span class="badge badge-get">GET</span><code>/api/v1/documents</code></div>
  <p>List documents in your vault with pagination.</p>
  <table class="param-table">
    <tr><th>Param</th><th>Type</th><th>Default</th><th>Description</th></tr>
    <tr><td><code>limit</code></td><td>integer</td><td>25</td><td>Results per page (max 100)</td></tr>
    <tr><td><code>offset</code></td><td>integer</td><td>0</td><td>Pagination offset</td></tr>
    <tr><td><code>sort</code></td><td>string</td><td>created_desc</td><td><code>created_asc</code>, <code>created_desc</code>, <code>title_asc</code></td></tr>
  </table>
  <pre><button class="copy-btn" onclick="copyCode(this)">Copy</button><code>{
  "success": true,
  "data": {
    "documents": [
      { "id": "doc_abc123", "title": "Service Agreement", "status": "ready", "pages": 12, "created_at": "2026-02-20T14:30:00Z" }
    ],
    "total": 47,
    "limit": 25,
    "offset": 0
  }
}</code></pre>
</div>

<div class="endpoint">
  <div class="endpoint-header"><span class="badge badge-post">POST</span><code>/api/v1/documents</code></div>
  <p>Upload a document (multipart/form-data).</p>
  <table class="param-table">
    <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
    <tr><td><code>file</code></td><td>file</td><td>Yes</td><td>PDF, DOCX, TXT, MD (max 50 MB)</td></tr>
    <tr><td><code>title</code></td><td>string</td><td>No</td><td>Display title (defaults to filename)</td></tr>
    <tr><td><code>folder_id</code></td><td>string</td><td>No</td><td>Target folder ID</td></tr>
  </table>
  <pre><button class="copy-btn" onclick="copyCode(this)">Copy</button><code>{
  "success": true,
  "data": { "id": "doc_xyz789", "title": "Contract.pdf", "status": "processing", "created_at": "2026-02-21T10:00:00Z" }
}</code></pre>
</div>

<div class="endpoint">
  <div class="endpoint-header"><span class="badge badge-get">GET</span><code>/api/v1/documents/:id</code></div>
  <p>Retrieve a single document by ID, including metadata and processing status.</p>
</div>

<div class="endpoint">
  <div class="endpoint-header"><span class="badge badge-delete">DELETE</span><code>/api/v1/documents/:id</code></div>
  <p>Permanently delete a document and its embeddings from your vault.</p>
</div>

<!-- RAG Query -->
<h2 id="rag-query">RAG Query</h2>

<div class="endpoint">
  <div class="endpoint-header"><span class="badge badge-post">POST</span><code>/api/v1/query</code></div>
  <p>Ask a natural-language question against your document vault.</p>
  <table class="param-table">
    <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
    <tr><td><code>query</code></td><td>string</td><td>Yes</td><td>The question to ask</td></tr>
    <tr><td><code>conversation_id</code></td><td>string</td><td>No</td><td>Continue a prior conversation</td></tr>
    <tr><td><code>model</code></td><td>string</td><td>No</td><td><code>gemini-1.5-pro</code> (default), <code>gemini-1.5-flash</code></td></tr>
    <tr><td><code>stream</code></td><td>boolean</td><td>No</td><td>Enable SSE streaming (default false)</td></tr>
  </table>

  <h3>Non-streaming response</h3>
  <pre><button class="copy-btn" onclick="copyCode(this)">Copy</button><code>{
  "success": true,
  "data": {
    "answer": "The termination clause allows either party to exit with 30 days written notice [1].",
    "confidence": 0.91,
    "sources": [
      { "index": 1, "documentId": "doc_abc123", "documentName": "Service Agreement", "excerpt": "Either party may terminate..." }
    ],
    "silenceProtocol": false
  }
}</code></pre>

  <h3>Silence Protocol</h3>
  <p>When confidence falls below the threshold (default 0.60), the Silence Protocol activates:</p>
  <pre><button class="copy-btn" onclick="copyCode(this)">Copy</button><code>{
  "success": true,
  "data": {
    "answer": null,
    "confidence": 0.32,
    "sources": [],
    "silenceProtocol": true
  }
}</code></pre>

  <h3>SSE Streaming (<code>stream: true</code>)</h3>
  <pre><button class="copy-btn" onclick="copyCode(this)">Copy</button><code>event: token
data: {"text": "The termination"}

event: token
data: {"text": " clause allows"}

event: done
data: {"confidence": 0.91, "sources": [...]}</code></pre>
</div>

<!-- Knowledge -->
<h2 id="knowledge">Knowledge</h2>

<div class="endpoint">
  <div class="endpoint-header"><span class="badge badge-get">GET</span><code>/api/v1/knowledge?q=...&amp;limit=5</code></div>
  <p>Semantic search across your vault. Returns the most relevant chunks without generating an answer.</p>
  <table class="param-table">
    <tr><th>Param</th><th>Type</th><th>Default</th><th>Description</th></tr>
    <tr><td><code>q</code></td><td>string</td><td>&mdash;</td><td>Search query (required)</td></tr>
    <tr><td><code>limit</code></td><td>integer</td><td>5</td><td>Max results (1-20)</td></tr>
  </table>
</div>

<!-- API Keys -->
<h2 id="api-keys">API Keys</h2>

<div class="endpoint">
  <div class="endpoint-header"><span class="badge badge-get">GET</span><code>/api/v1/keys</code></div>
  <p>List all API keys for your account. Key values are masked.</p>
</div>

<div class="endpoint">
  <div class="endpoint-header"><span class="badge badge-post">POST</span><code>/api/v1/keys</code></div>
  <p>Create a new API key. The full key is returned <strong>only once</strong> in the response.</p>
  <table class="param-table">
    <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
    <tr><td><code>name</code></td><td>string</td><td>Yes</td><td>Display name for the key</td></tr>
    <tr><td><code>expires_at</code></td><td>ISO 8601</td><td>No</td><td>Expiration date (null = never)</td></tr>
  </table>
  <pre><button class="copy-btn" onclick="copyCode(this)">Copy</button><code>{
  "success": true,
  "data": {
    "id": "key_m9x2f",
    "name": "CI Pipeline",
    "key": "rbx_live_a1b2c3d4e5f6...",
    "created_at": "2026-02-21T12:00:00Z",
    "expires_at": null
  }
}</code></pre>
</div>

<div class="endpoint">
  <div class="endpoint-header"><span class="badge badge-delete">DELETE</span><code>/api/v1/keys/:id</code></div>
  <p>Permanently revoke an API key. Takes effect immediately.</p>
</div>

<!-- MCP -->
<h2 id="mcp">MCP (Model Context Protocol)</h2>

<div class="endpoint">
  <div class="endpoint-header"><span class="badge badge-post">POST</span><code>/api/mcp</code></div>
  <p>Model Context Protocol endpoint for AI agent integrations. Exposes RAGbox tools (query, upload, search) to MCP-compatible clients such as Claude Desktop and Cursor.</p>
  <p>See full MCP schema at <a href="/api/mcp/docs">/api/mcp/docs</a>.</p>
</div>

<!-- Mercury Chat -->
<h2 id="mercury">Mercury Chat</h2>

<div class="endpoint">
  <div class="endpoint-header"><span class="badge badge-post">POST</span><code>/api/mercury/thread/messages</code></div>
  <p>Send a message to a Mercury chat thread. Creates the thread if it does not exist.</p>
  <pre><button class="copy-btn" onclick="copyCode(this)">Copy</button><code>{ "content": "Summarize the latest filing", "thread_id": "thr_abc123" }</code></pre>
</div>

<div class="endpoint">
  <div class="endpoint-header"><span class="badge badge-get">GET</span><code>/api/mercury/thread/messages?limit=50</code></div>
  <p>Retrieve messages from a thread. Supports <code>limit</code> (default 50) and <code>cursor</code> pagination.</p>
</div>

<!-- Webhooks -->
<h2 id="webhooks">Webhooks</h2>

<div class="endpoint">
  <div class="endpoint-header"><span class="badge badge-post">POST</span><code>/api/webhooks/roam</code></div>
  <p>Inbound webhook for Roam integrations. Payloads are verified using <strong>HMAC-SHA256</strong> signatures in the <code>X-Signature</code> header.</p>
</div>

<div class="endpoint">
  <div class="endpoint-header"><span class="badge badge-get">GET</span> <span class="badge badge-post">POST</span><code>/api/webhooks/whatsapp</code></div>
  <p>Vonage WhatsApp webhook. GET handles verification challenges; POST receives inbound messages.</p>
</div>

<!-- Audit -->
<h2 id="audit">Audit</h2>

<div class="endpoint">
  <div class="endpoint-header"><span class="badge badge-get">GET</span><code>/api/audit?action=...&amp;limit=50</code></div>
  <p>Query the Veritas audit log. Filter by <code>action</code> (e.g. <code>document.upload</code>, <code>query.execute</code>) and paginate with <code>limit</code> / <code>offset</code>.</p>
</div>

<div class="endpoint">
  <div class="endpoint-header"><span class="badge badge-get">GET</span><code>/api/audit/export?format=json|pdf</code></div>
  <p>Export audit records. Accepts <code>format=json</code> or <code>format=pdf</code>. PDF exports are formatted for regulatory submission.</p>
</div>

<!-- Health -->
<h2 id="health">Health</h2>

<div class="endpoint">
  <div class="endpoint-header"><span class="badge badge-get">GET</span><code>/api/health</code></div>
  <p>Returns service health status. No authentication required.</p>
  <pre><button class="copy-btn" onclick="copyCode(this)">Copy</button><code>{ "status": "ok", "version": "1.0.0", "uptime": 86400 }</code></pre>
</div>

<!-- Errors -->
<h2 id="errors">Error Responses</h2>
<p>All errors follow a consistent envelope:</p>
<pre><button class="copy-btn" onclick="copyCode(this)">Copy</button><code>{ "success": false, "error": { "type": "validation_error", "message": "query field is required" } }</code></pre>
<table>
  <tr><th>Status</th><th>Type</th><th>Description</th></tr>
  <tr><td>400</td><td><code>validation_error</code></td><td>Missing or invalid request parameters</td></tr>
  <tr><td>401</td><td><code>authentication_error</code></td><td>Missing or invalid API key</td></tr>
  <tr><td>403</td><td><code>forbidden</code></td><td>Key lacks required scope</td></tr>
  <tr><td>404</td><td><code>not_found</code></td><td>Resource does not exist</td></tr>
  <tr><td>429</td><td><code>rate_limit_exceeded</code></td><td>Too many requests (see Retry-After header)</td></tr>
  <tr><td>500</td><td><code>internal_error</code></td><td>Unexpected server error</td></tr>
</table>

<!-- Security -->
<h2 id="security">Security</h2>
<table>
  <tr><th>Layer</th><th>Detail</th></tr>
  <tr><td>Transport</td><td>TLS 1.3 enforced on all endpoints</td></tr>
  <tr><td>Encryption at rest</td><td>AES-256 via Google Cloud CMEK</td></tr>
  <tr><td>Key management</td><td>Customer-Managed Encryption Keys (CMEK) in Cloud KMS</td></tr>
  <tr><td>DLP</td><td>PII/PHI redaction before embedding</td></tr>
  <tr><td>Row-level security</td><td>Tenant isolation via RLS policies in AlloyDB</td></tr>
  <tr><td>Audit trail</td><td>Immutable Veritas log (BigQuery WORM storage)</td></tr>
  <tr><td>Compliance</td><td>SOC 2 Type II + HIPAA-ready architecture</td></tr>
</table>

<!-- SDK Examples -->
<h2 id="sdks">SDK Examples</h2>

<h3>Python (httpx)</h3>
<pre><button class="copy-btn" onclick="copyCode(this)">Copy</button><code>import httpx

client = httpx.Client(
    base_url="https://app.ragbox.co/api/v1",
    headers={"X-API-Key": "rbx_live_YOUR_KEY"},
)

# Upload a document
with open("contract.pdf", "rb") as f:
    resp = client.post("/documents", files={"file": f}, data={"title": "Contract"})
    print(resp.json())

# Query the vault
resp = client.post("/query", json={"query": "What are the payment terms?"})
print(resp.json()["data"]["answer"])</code></pre>

<h3>JavaScript (fetch)</h3>
<pre><button class="copy-btn" onclick="copyCode(this)">Copy</button><code>const API = "https://app.ragbox.co/api/v1";
const KEY = "rbx_live_YOUR_KEY";

const res = await fetch(API + "/query", {
  method: "POST",
  headers: { "X-API-Key": KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ query: "Summarize the NDA" }),
});

const { data } = await res.json();
console.log(data.answer);</code></pre>

<h3>cURL</h3>
<pre><button class="copy-btn" onclick="copyCode(this)">Copy</button><code>curl https://app.ragbox.co/api/v1/documents \\
  -H "X-API-Key: rbx_live_YOUR_KEY"</code></pre>

<hr style="border-color:var(--border);margin-top:3rem">
<p style="color:var(--text3);font-size:.85rem">&copy; 2026 ConnexUS AI Inc. &mdash; RAGbox API v1.0</p>

</main>

<script>
function copyCode(btn){const code=btn.parentElement.querySelector('code');navigator.clipboard.writeText(code.textContent);btn.textContent='\\u2713 Copied';setTimeout(()=>btn.textContent='Copy',2000)}

// Sidebar active-link tracking
document.addEventListener('DOMContentLoaded',()=>{
  const links=document.querySelectorAll('.nav-link');
  const ids=[...links].map(l=>l.getAttribute('href').slice(1));
  const sections=ids.map(id=>document.getElementById(id)).filter(Boolean);
  const observer=new IntersectionObserver(entries=>{
    entries.forEach(e=>{if(e.isIntersecting){
      links.forEach(l=>l.classList.remove('active'));
      const a=document.querySelector('.nav-link[href="#'+e.target.id+'"]');
      if(a)a.classList.add('active');
    }});
  },{rootMargin:'-20% 0px -70% 0px'});
  sections.forEach(s=>observer.observe(s));
});
</script>

</body>
</html>`

export async function GET(): Promise<NextResponse> {
  return new NextResponse(HTML, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
