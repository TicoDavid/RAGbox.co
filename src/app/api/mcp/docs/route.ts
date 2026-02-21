import { NextResponse } from 'next/server'

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>RAGbox MCP Server Specification v1.0</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0a192f;--bg2:#112240;--bg3:#1a2f50;--text:#e5e7eb;--dim:#8892b0;--blue:#2463EB;--blue2:#60a5fa;--green:#22c55e;--red:#ef4444;--orange:#f59e0b;--border:#1e3a5f;--code-bg:#0d1f3c;--sidebar-w:260px}
html{scroll-behavior:smooth}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:var(--bg);color:var(--text);line-height:1.7;display:flex;min-height:100vh}
a{color:var(--blue2);text-decoration:none}a:hover{text-decoration:underline}

/* Sidebar */
.sidebar{position:fixed;top:0;left:0;width:var(--sidebar-w);height:100vh;background:var(--bg2);border-right:1px solid var(--border);padding:24px 0;overflow-y:auto;z-index:10}
.sidebar .logo{padding:0 20px 20px;font-size:18px;font-weight:700;color:#fff;border-bottom:1px solid var(--border)}
.sidebar .logo span{color:var(--blue2)}
.sidebar nav{padding:16px 0}
.sidebar nav a{display:block;padding:8px 20px;color:var(--dim);font-size:14px;transition:all .15s}
.sidebar nav a:hover,.sidebar nav a.active{color:#fff;background:var(--bg3);text-decoration:none;border-left:3px solid var(--blue)}

/* Main */
.main{margin-left:var(--sidebar-w);flex:1;max-width:900px;padding:48px 48px 96px}
h1{font-size:32px;font-weight:800;margin-bottom:8px}
h2{font-size:24px;font-weight:700;margin:48px 0 16px;padding-bottom:8px;border-bottom:1px solid var(--border);scroll-margin-top:24px}
h3{font-size:18px;font-weight:600;margin:32px 0 12px;color:var(--blue2)}
p{margin-bottom:16px}
.badge{display:inline-block;background:var(--blue);color:#fff;font-size:12px;font-weight:600;padding:4px 10px;border-radius:12px;margin-left:8px;vertical-align:middle}
.subtitle{color:var(--dim);font-size:16px;margin-bottom:32px}

/* Tables */
table{width:100%;border-collapse:collapse;margin:16px 0 24px;font-size:14px}
th{text-align:left;padding:10px 12px;background:var(--bg3);color:var(--blue2);border:1px solid var(--border);font-weight:600}
td{padding:10px 12px;border:1px solid var(--border)}
tr:hover td{background:var(--bg2)}
code.inline{background:var(--code-bg);padding:2px 6px;border-radius:4px;font-size:13px;color:var(--blue2)}

/* Code blocks */
.code-wrap{position:relative;margin:16px 0 24px;border-radius:8px;overflow:hidden;border:1px solid var(--border)}
.code-wrap .label{background:var(--bg3);padding:6px 14px;font-size:12px;font-weight:600;color:var(--dim);border-bottom:1px solid var(--border)}
.code-wrap pre{background:var(--code-bg);padding:16px;overflow-x:auto;font-size:13px;line-height:1.6}
.code-wrap code{color:var(--text);font-family:'Fira Code',Consolas,monospace}
.copy-btn{position:absolute;top:6px;right:8px;background:var(--bg3);color:var(--dim);border:1px solid var(--border);padding:4px 10px;border-radius:4px;font-size:12px;cursor:pointer}
.copy-btn:hover{color:#fff;border-color:var(--blue)}

/* Misc */
.param{margin:8px 0 8px 16px;font-size:14px}
.param b{color:var(--blue2)}
.param .req{color:var(--red);font-size:11px;font-weight:600}
.param .opt{color:var(--dim);font-size:11px}
.note{background:var(--bg2);border-left:3px solid var(--blue);padding:12px 16px;border-radius:0 6px 6px 0;margin:16px 0;font-size:14px}
.warn{border-left-color:var(--orange)}
ul{margin:8px 0 16px 24px}li{margin:4px 0}

/* Responsive */
@media(max-width:860px){
  .sidebar{position:relative;width:100%;height:auto;border-right:none;border-bottom:1px solid var(--border)}
  .sidebar nav{display:flex;flex-wrap:wrap;gap:4px;padding:8px 12px}
  .sidebar nav a{padding:6px 12px;border-radius:6px;border-left:none!important}
  .main{margin-left:0;padding:24px 16px 64px}
  body{flex-direction:column}
}
</style>
</head>
<body>

<aside class="sidebar">
  <div class="logo">RAG<span>box</span>.co</div>
  <nav>
    <a href="#overview">Overview</a>
    <a href="#authentication">Authentication</a>
    <a href="#tools">Available Tools</a>
    <a href="#tool-search">search_documents</a>
    <a href="#tool-get">get_document</a>
    <a href="#tool-query">query_knowledge</a>
    <a href="#tool-list">list_documents</a>
    <a href="#protocol">Protocol Methods</a>
    <a href="#rate-limits">Rate Limits</a>
    <a href="#security">Security</a>
    <a href="#integration">Integration Guides</a>
    <a href="#errors">Error Codes</a>
    <a href="#changelog">Changelog</a>
  </nav>
</aside>

<main class="main">

<h1>RAGbox MCP Server Specification <span class="badge">Model Context Protocol</span></h1>
<p class="subtitle">Version 1.0 &mdash; Production API Reference</p>

<!-- ─── Overview ─── -->
<h2 id="overview">Overview</h2>
<p>The RAGbox MCP Server exposes your document vault to any MCP-compliant AI client over a secure JSON-RPC 2.0 interface. Clients can search, retrieve, and query documents with full citation support.</p>
<table>
  <tr><th>Endpoint</th><td><code class="inline">POST https://app.ragbox.co/api/mcp</code></td></tr>
  <tr><th>Auth</th><td>API key via <code class="inline">X-API-Key</code> header</td></tr>
  <tr><th>Transport</th><td>JSON-RPC 2.0 over HTTPS</td></tr>
  <tr><th>MCP Version</th><td>v1.0 (protocol version <code class="inline">2024-11-05</code>)</td></tr>
</table>

<!-- ─── Authentication ─── -->
<h2 id="authentication">Authentication</h2>
<p>Generate an API key from the <strong>RAGbox Dashboard &rarr; Settings &rarr; API Keys</strong>. Keys use the format:</p>
<div class="code-wrap"><div class="label">Key Format</div><pre><code>rbx_live_&lt;64 hex characters&gt;</code></pre><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>
<p>Include the key in every request:</p>
<div class="code-wrap"><div class="label">Request Headers</div><pre><code>POST /api/mcp HTTP/1.1
Host: app.ragbox.co
Content-Type: application/json
X-API-Key: rbx_live_a1b2c3d4e5f6...
</code></pre><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>

<!-- ─── Available Tools ─── -->
<h2 id="tools">Available Tools</h2>
<table>
  <tr><th>Tool</th><th>Description</th></tr>
  <tr><td><code class="inline">search_documents</code></td><td>Semantic vector search across your document vault</td></tr>
  <tr><td><code class="inline">get_document</code></td><td>Retrieve a document by its unique ID</td></tr>
  <tr><td><code class="inline">query_knowledge</code></td><td>RAG-powered query with inline citations and Silence Protocol</td></tr>
  <tr><td><code class="inline">list_documents</code></td><td>List and paginate all documents in your vault</td></tr>
</table>

<!-- ─── search_documents ─── -->
<h3 id="tool-search">search_documents</h3>
<p>Performs semantic similarity search across your indexed vault.</p>
<div class="code-wrap"><div class="label">Input Schema</div><pre><code>{
  "query":          { "type": "string",  "required": true },
  "limit":          { "type": "integer", "minimum": 1, "maximum": 20, "default": 5 },
  "privilege_mode": { "type": "boolean", "default": false }
}</code></pre><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>
<div class="code-wrap"><div class="label">Example Request</div><pre><code>{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "search_documents",
    "arguments": {
      "query": "cancellation policy",
      "limit": 3
    }
  }
}</code></pre><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>
<div class="code-wrap"><div class="label">Example Response</div><pre><code>{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{
      "type": "text",
      "text": "[{\\"document_id\\":\\"doc_abc123\\",\\"title\\":\\"Service Agreement\\",\\"score\\":0.94,\\"snippet\\":\\"Clients may cancel within 30 days...\\"}]"
    }]
  }
}</code></pre><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>

<!-- ─── get_document ─── -->
<h3 id="tool-get">get_document</h3>
<p>Retrieve a single document by ID, optionally including full content.</p>
<div class="code-wrap"><div class="label">Input Schema</div><pre><code>{
  "document_id":     { "type": "string",  "required": true },
  "include_content": { "type": "boolean", "default": false }
}</code></pre><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>
<div class="code-wrap"><div class="label">Example Request</div><pre><code>{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "get_document",
    "arguments": {
      "document_id": "doc_abc123",
      "include_content": true
    }
  }
}</code></pre><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>
<div class="code-wrap"><div class="label">Example Response</div><pre><code>{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [{
      "type": "text",
      "text": "{\\"document_id\\":\\"doc_abc123\\",\\"title\\":\\"Service Agreement\\",\\"size\\":24580,\\"uploaded_at\\":\\"2026-01-15T08:30:00Z\\",\\"content\\":\\"...full text...\\"}"
    }]
  }
}</code></pre><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>

<!-- ─── query_knowledge ─── -->
<h3 id="tool-query">query_knowledge</h3>
<p>RAG-powered query that retrieves relevant documents and generates a cited answer. If the vault contains no relevant information, the <strong>Silence Protocol</strong> engages and the model declines to answer rather than hallucinate.</p>
<div class="code-wrap"><div class="label">Input Schema</div><pre><code>{
  "query":           { "type": "string", "required": true },
  "conversation_id": { "type": "string" },
  "model":           { "type": "string", "enum": ["gemini-1.5-flash","claude-3.5-sonnet","gpt-4o"] }
}</code></pre><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>
<div class="code-wrap"><div class="label">Example Request</div><pre><code>{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "query_knowledge",
    "arguments": {
      "query": "What is the cancellation policy?",
      "model": "claude-3.5-sonnet"
    }
  }
}</code></pre><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>
<div class="code-wrap"><div class="label">Confident Answer</div><pre><code>{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [{
      "type": "text",
      "text": "{\\"answer\\":\\"Clients may cancel within 30 days of signing for a full refund [1].\\",\\"citations\\":[{\\"index\\":1,\\"document_id\\":\\"doc_abc123\\",\\"title\\":\\"Service Agreement\\",\\"snippet\\":\\"Clients may cancel within 30 days...\\"}],\\"confidence\\":0.94}"
    }]
  }
}</code></pre><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>
<div class="code-wrap"><div class="label">Silence Protocol (No Relevant Data)</div><pre><code>{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "content": [{
      "type": "text",
      "text": "{\\"answer\\":null,\\"silence_protocol\\":true,\\"reason\\":\\"No documents in the vault contain information relevant to this query.\\",\\"confidence\\":0.0}"
    }]
  }
}</code></pre><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>

<!-- ─── list_documents ─── -->
<h3 id="tool-list">list_documents</h3>
<p>Paginate and sort the full document inventory.</p>
<div class="code-wrap"><div class="label">Input Schema</div><pre><code>{
  "limit":  { "type": "integer", "minimum": 1, "maximum": 100, "default": 50 },
  "offset": { "type": "integer", "default": 0 },
  "sort":   { "type": "string",  "enum": ["title","uploaded_at","size"] }
}</code></pre><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>
<div class="code-wrap"><div class="label">Example Request</div><pre><code>{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "list_documents",
    "arguments": { "limit": 10, "sort": "uploaded_at" }
  }
}</code></pre><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>

<!-- ─── Protocol Methods ─── -->
<h2 id="protocol">Protocol Methods</h2>
<h3>initialize</h3>
<p>Handshake to establish protocol version and capabilities.</p>
<div class="code-wrap"><div class="label">Request</div><pre><code>{
  "jsonrpc": "2.0",
  "id": 0,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "clientInfo": { "name": "my-client", "version": "1.0.0" },
    "capabilities": {}
  }
}</code></pre><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>
<div class="code-wrap"><div class="label">Response</div><pre><code>{
  "jsonrpc": "2.0",
  "id": 0,
  "result": {
    "protocolVersion": "2024-11-05",
    "serverInfo": { "name": "ragbox-mcp", "version": "1.0.0" },
    "capabilities": { "tools": { "listChanged": false } }
  }
}</code></pre><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>

<h3>tools/list</h3>
<p>Returns all available tools and their input schemas.</p>
<div class="code-wrap"><div class="label">Request</div><pre><code>{ "jsonrpc": "2.0", "id": 1, "method": "tools/list" }</code></pre><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>

<!-- ─── Rate Limits ─── -->
<h2 id="rate-limits">Rate Limits</h2>
<table>
  <tr><th>Scope</th><th>Limit</th></tr>
  <tr><td>MCP endpoint (total)</td><td>60 requests / minute</td></tr>
  <tr><td><code class="inline">query_knowledge</code></td><td>10 requests / minute</td></tr>
  <tr><td>Concurrent connections</td><td>5 per API key</td></tr>
</table>
<p>Rate-limit state is returned in response headers:</p>
<div class="code-wrap"><div class="label">Rate Limit Headers</div><pre><code>X-RateLimit-Limit: 60
X-RateLimit-Remaining: 58
X-RateLimit-Reset: 1740200000</code></pre><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>

<!-- ─── Security ─── -->
<h2 id="security">Security</h2>
<ul>
  <li><strong>Transport</strong> &mdash; HTTPS required; plaintext requests are rejected.</li>
  <li><strong>Key Storage</strong> &mdash; API keys are SHA-256 hashed at rest; raw keys are never stored.</li>
  <li><strong>Privilege Tiers</strong> &mdash; <code class="inline">privilege_mode</code> grants access to restricted documents based on the key's assigned tier.</li>
  <li><strong>Audit Trail</strong> &mdash; All MCP calls are logged with immutable retention per SEC 17a-4 requirements.</li>
  <li><strong>PII Redaction</strong> &mdash; Personally identifiable information is automatically redacted from responses unless the key holds a PII-access privilege.</li>
  <li><strong>Multi-Tenant Isolation</strong> &mdash; Each organization's vault is fully isolated; cross-tenant access is impossible by design.</li>
</ul>

<!-- ─── Integration Guides ─── -->
<h2 id="integration">Integration Guides</h2>

<h3>Claude Desktop</h3>
<p>Add to your <code class="inline">claude_desktop_config.json</code>:</p>
<div class="code-wrap"><div class="label">claude_desktop_config.json</div><pre><code>{
  "mcpServers": {
    "ragbox": {
      "url": "https://app.ragbox.co/api/mcp",
      "headers": {
        "X-API-Key": "rbx_live_YOUR_KEY_HERE"
      }
    }
  }
}</code></pre><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>

<h3>ConnexUS ATHENA V-Rep</h3>
<div class="code-wrap"><div class="label">mcp_servers config</div><pre><code>{
  "mcp_servers": {
    "ragbox": {
      "endpoint": "https://app.ragbox.co/api/mcp",
      "auth": { "type": "api_key", "header": "X-API-Key", "key_env": "RAGBOX_API_KEY" }
    }
  }
}</code></pre><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>

<h3>Any MCP Client (Python)</h3>
<div class="code-wrap"><div class="label">Python &mdash; httpx</div><pre><code>import httpx

resp = httpx.post(
    "https://app.ragbox.co/api/mcp",
    headers={"X-API-Key": "rbx_live_YOUR_KEY_HERE", "Content-Type": "application/json"},
    json={
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": "search_documents",
            "arguments": {"query": "revenue projections", "limit": 5}
        }
    }
)
print(resp.json())</code></pre><button class="copy-btn" onclick="copyCode(this)">Copy</button></div>

<!-- ─── Error Codes ─── -->
<h2 id="errors">Error Codes</h2>
<table>
  <tr><th>Code</th><th>HTTP</th><th>Meaning</th></tr>
  <tr><td>-32700</td><td>400</td><td>Parse error &mdash; invalid JSON</td></tr>
  <tr><td>-32600</td><td>400</td><td>Invalid request &mdash; missing required fields</td></tr>
  <tr><td>-32601</td><td>404</td><td>Method not found</td></tr>
  <tr><td>-32602</td><td>422</td><td>Invalid params &mdash; schema validation failed</td></tr>
  <tr><td>-32603</td><td>500</td><td>Internal error</td></tr>
  <tr><td>-32000</td><td>401</td><td>Authentication failed &mdash; invalid or missing API key</td></tr>
  <tr><td>-32001</td><td>429</td><td>Rate limit exceeded</td></tr>
  <tr><td>-32002</td><td>403</td><td>Insufficient privileges for requested resource</td></tr>
</table>

<!-- ─── Changelog ─── -->
<h2 id="changelog">Changelog</h2>
<table>
  <tr><th>Version</th><th>Date</th><th>Notes</th></tr>
  <tr><td>1.0</td><td>2026-02-21</td><td>Initial release &mdash; search, retrieve, query, list tools; Silence Protocol; SEC 17a-4 audit trail</td></tr>
</table>

<p style="margin-top:48px;color:var(--dim);font-size:13px">&copy; 2026 RAGbox.co &mdash; All rights reserved.</p>
</main>

<script>
function copyCode(btn){const code=btn.parentElement.querySelector('code');navigator.clipboard.writeText(code.textContent);btn.textContent='\\u2713 Copied';setTimeout(()=>btn.textContent='Copy',2000)}

// Sidebar scroll tracking
document.addEventListener('DOMContentLoaded',()=>{
  const links=document.querySelectorAll('.sidebar nav a');
  const ids=[...links].map(a=>a.getAttribute('href').slice(1));
  const targets=ids.map(id=>document.getElementById(id)).filter(Boolean);
  const obs=new IntersectionObserver(entries=>{
    entries.forEach(e=>{if(e.isIntersecting){
      links.forEach(a=>a.classList.remove('active'));
      const match=[...links].find(a=>a.getAttribute('href')==='#'+e.target.id);
      if(match)match.classList.add('active');
    }});
  },{rootMargin:'-20% 0px -75% 0px'});
  targets.forEach(t=>obs.observe(t));
});
</script>
</body>
</html>`;

export async function GET(): Promise<NextResponse> {
  return new NextResponse(HTML, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
