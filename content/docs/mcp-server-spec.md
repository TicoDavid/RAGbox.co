# RAGbox MCP Server Specification

> **Endpoint:** `POST https://app.ragbox.co/api/mcp` | **Protocol:** JSON-RPC 2.0 over HTTPS | **Version 1.0**

RAGbox exposes a **Model Context Protocol (MCP)** server that allows any MCP-compatible AI agent — including Claude, GPT-4, Gemini, or ConnexUS V-Reps — to query your sovereign document vault, search knowledge, and retrieve cited answers.

---

## Authentication

All MCP requests require a valid RAGbox API key.

### Obtaining an API Key

1. Login to https://app.ragbox.co
2. Navigate to **Settings → API Keys**
3. Click **Create API Key**
4. Copy the key immediately — it is shown only once

### Key Format

```
rbx_live_[64-character hexadecimal string]
```

### Request Headers

```http
POST /api/mcp HTTP/1.1
Host: app.ragbox.co
Content-Type: application/json
X-API-Key: rbx_live_your_key_here
```

---

## Available Tools

RAGbox exposes four MCP tools:

| Tool | Description | Use Case |
|------|-------------|----------|
| `search_documents` | Semantic search across the vault | Find relevant documents by topic |
| `get_document` | Retrieve a specific document by ID | Get full document details and metadata |
| `query_knowledge` | RAG query with citations | Ask questions, get answers with sources |
| `list_documents` | List all documents in the vault | Inventory check, file listing |

---

## Tool Definitions

### 1. search_documents

Performs semantic vector search across all documents in the authenticated user's vault.

**Input Schema:**
```json
{
  "name": "search_documents",
  "description": "Search the document vault using semantic similarity",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Natural language search query"
      },
      "limit": {
        "type": "integer",
        "description": "Maximum results to return (1-20, default 5)",
        "default": 5
      },
      "privilege_mode": {
        "type": "boolean",
        "description": "Include privileged documents (requires elevated access)",
        "default": false
      }
    },
    "required": ["query"]
  }
}
```

**Example Request:**
```json
{
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
}
```

**Example Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "[{\"id\":\"doc_abc123\",\"title\":\"Office Policies v2.3\",\"relevance\":0.94,\"snippet\":\"24-hour cancellation policy applies to all appointments...\",\"security_tier\":\"standard\"}]"
      }
    ]
  }
}
```

---

### 2. get_document

Retrieves full metadata and content for a specific document.

**Input Schema:**
```json
{
  "name": "get_document",
  "description": "Get a specific document by ID with full metadata",
  "inputSchema": {
    "type": "object",
    "properties": {
      "document_id": {
        "type": "string",
        "description": "The document ID (from search results or list)"
      },
      "include_content": {
        "type": "boolean",
        "description": "Include full text content (default: false for metadata only)",
        "default": false
      }
    },
    "required": ["document_id"]
  }
}
```

**Example Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "get_document",
    "arguments": {
      "document_id": "doc_abc123",
      "include_content": false
    }
  }
}
```

**Example Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"id\":\"doc_abc123\",\"title\":\"Office Policies v2.3\",\"filename\":\"office-policies.pdf\",\"size_bytes\":245760,\"pages\":12,\"chunks\":34,\"security_tier\":\"standard\",\"indexed\":true,\"uploaded_at\":\"2026-02-15T10:30:00Z\"}"
      }
    ]
  }
}
```

---

### 3. query_knowledge

The core RAG query tool. Asks a question against the vault and returns an answer with citations — or triggers the Silence Protocol if confidence is below threshold.

**Input Schema:**
```json
{
  "name": "query_knowledge",
  "description": "Ask a question and get a cited answer from the document vault. Returns answer with source citations, or a structured refusal if confidence is insufficient.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "Natural language question to ask against the vault"
      },
      "conversation_id": {
        "type": "string",
        "description": "Optional conversation ID for multi-turn context"
      },
      "model": {
        "type": "string",
        "description": "LLM model override (default: user's configured model)",
        "enum": ["gemini-1.5-flash", "claude-3.5-sonnet", "gpt-4o"]
      }
    },
    "required": ["query"]
  }
}
```

**Example Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "query_knowledge",
    "arguments": {
      "query": "What is the cancellation fee?"
    }
  }
}
```

**Example Response (confident answer):**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"answer\":\"The cancellation fee is $50 for appointments cancelled less than 24 hours in advance.\",\"confidence\":0.92,\"sources\":[{\"document\":\"Office Policies v2.3\",\"page\":4,\"section\":\"4.1 Cancellation Policy\",\"relevance\":0.94}],\"silence\":false}"
      }
    ]
  }
}
```

**Example Response (Silence Protocol — insufficient confidence):**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"answer\":\"\",\"confidence\":0.31,\"sources\":[],\"silence\":true,\"silence_reason\":\"No documents in the vault contain information about this topic.\"}"
      }
    ]
  }
}
```

---

### 4. list_documents

Returns all documents in the vault with basic metadata.

**Input Schema:**
```json
{
  "name": "list_documents",
  "description": "List all documents in the vault with metadata",
  "inputSchema": {
    "type": "object",
    "properties": {
      "limit": {
        "type": "integer",
        "description": "Maximum results (1-100, default 50)",
        "default": 50
      },
      "offset": {
        "type": "integer",
        "description": "Pagination offset",
        "default": 0
      },
      "sort": {
        "type": "string",
        "description": "Sort field",
        "enum": ["title", "uploaded_at", "size"],
        "default": "uploaded_at"
      }
    }
  }
}
```

**Example Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "list_documents",
    "arguments": {
      "limit": 10,
      "sort": "uploaded_at"
    }
  }
}
```

---

## Protocol Methods

### Initialize

```json
{
  "jsonrpc": "2.0",
  "id": 0,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": {
      "name": "your-agent-name",
      "version": "1.0.0"
    }
  }
}
```

### List Tools

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
```

---

## Rate Limits

| Scope | Limit |
|-------|-------|
| MCP requests (total) | 60/min per API key |
| query_knowledge calls | 10/min per API key |
| Concurrent connections | 5 per API key |

Rate limit headers are returned on every response:
```http
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 57
X-RateLimit-Reset: 1708545600
```

---

## Security

- All requests require HTTPS
- API keys are SHA-256 hashed at rest (never stored in plaintext)
- Document access respects privilege tiers (Standard / Confidential / Privileged)
- All MCP queries are logged to the tamper-evident audit trail (SEC 17a-4)
- PII is redacted from documents during ingestion (names, emails, SSNs, credit cards)
- Multi-tenant isolation ensures API keys can only access their own vault

---

## Connecting from Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ragbox": {
      "url": "https://app.ragbox.co/api/mcp",
      "headers": {
        "X-API-Key": "rbx_live_your_key_here"
      }
    }
  }
}
```

## Connecting from ConnexUS ATHENA V-Rep

In the V-Rep configuration panel, add RAGbox as an MCP tool source:

```json
{
  "mcp_servers": [
    {
      "name": "ragbox",
      "url": "https://app.ragbox.co/api/mcp",
      "auth": {
        "type": "api_key",
        "header": "X-API-Key",
        "key_env": "RAGBOX_API_KEY"
      }
    }
  ]
}
```

## Connecting from Any MCP Client

```python
import httpx

response = httpx.post(
    "https://app.ragbox.co/api/mcp",
    headers={
        "Content-Type": "application/json",
        "X-API-Key": "rbx_live_your_key_here"
    },
    json={
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {
            "name": "query_knowledge",
            "arguments": {"query": "What is our refund policy?"}
        }
    }
)
print(response.json())
```

---

## Error Codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| -32700 | 400 | Parse error — invalid JSON |
| -32600 | 400 | Invalid request — missing required fields |
| -32601 | 404 | Method not found |
| -32602 | 400 | Invalid params — wrong argument types |
| -32000 | 401 | Unauthorized — missing or invalid API key |
| -32001 | 429 | Rate limited |
| -32002 | 500 | Internal error |

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-02-21 | Initial release — 4 tools, API key auth, JSON-RPC 2.0 |

---

*© 2026 ConnexUS AI Inc. — RAGbox is a product of ConnexUS AI. | support@ragbox.co*
