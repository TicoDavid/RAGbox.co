# CLAUDE.md - AI Assistant Guide for RAGbox.co

## Project Overview

**RAGbox.co** is a Retrieval-Augmented Generation (RAG) application that combines document search with AI-powered responses.

> **Note**: This is a new repository. Update this document as the codebase evolves.

---

## For Non-Developer Users

If you're new to Claude Code, here's how to work effectively:

### Talking to Claude

You can ask Claude to:
- **Build features**: "Create a document upload page"
- **Explain code**: "What does this function do?"
- **Fix bugs**: "The search isn't returning results"
- **Plan tasks**: "Help me plan a user authentication system"

### Useful Slash Commands

| Command | What It Does |
|---------|--------------|
| `/plan` | Create a detailed implementation plan before coding |
| `/tdd` | Use test-driven development (write tests first) |
| `/code-review` | Review code for quality and security |
| `/build-fix` | Fix build errors automatically |
| `/refactor-clean` | Clean up and improve existing code |

### Tips for Best Results

1. **Be specific**: "Add a search bar to the header" works better than "make search work"
2. **Give context**: Explain what you're trying to achieve
3. **Ask questions**: If unsure, ask Claude to explain options
4. **Review changes**: Always look at what Claude modified

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run test` | Run test suite |
| `npm run lint` | Run linter |

---

## Project Structure

```
RAGbox.co/
├── CLAUDE.md           # This file - AI assistant guide
├── README.md           # Project documentation
├── package.json        # Dependencies and scripts
├── .claude/            # Claude Code configurations
│   ├── agents/         # Specialized task agents
│   ├── rules/          # Coding guidelines
│   ├── commands/       # Custom slash commands
│   └── skills/         # Domain knowledge
├── src/                # Source code
│   ├── app/            # Next.js app router (pages)
│   ├── components/     # Reusable UI components
│   ├── lib/            # Shared utilities
│   ├── services/       # Business logic
│   │   ├── embedding/  # Vector embedding services
│   │   ├── retrieval/  # Document retrieval logic
│   │   └── generation/ # LLM generation services
│   └── types/          # TypeScript type definitions
├── tests/              # Test files
└── docs/               # Documentation
```

---

## Core Development Principles

### 1. Code Organization
- Many small files over few large files
- High cohesion, low coupling
- 200-400 lines typical, 800 max per file
- Organize by feature/domain, not by type

### 2. Code Style
- No emojis in code, comments, or documentation
- Immutability always - never mutate objects or arrays
- No console.log in production code
- Proper error handling with try/catch
- Input validation with Zod or similar

### 3. Testing (TDD)
- Write tests first
- 80% minimum coverage
- Unit tests for utilities
- Integration tests for APIs
- E2E tests for critical flows

### 4. Security (Mandatory)
- No hardcoded secrets
- Environment variables for sensitive data
- Validate all user inputs
- Parameterized queries only
- CSRF protection enabled

---

## RAG-Specific Guidelines

### Embedding Services
```typescript
// Use consistent embedding models
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-small'

// Cache embeddings to reduce costs
const cachedEmbedding = await cache.get(documentId)
if (cachedEmbedding) return cachedEmbedding

// Handle rate limits with exponential backoff
await fetchWithRetry(() => generateEmbedding(text), { maxRetries: 3 })
```

### Vector Database Best Practices
- Chunk size: 500-1000 tokens (consistent across app)
- Include metadata: `{ source, timestamp, category }`
- Similarity threshold: 0.7-0.8 for relevance
- Use HNSW indexes for fast retrieval

### LLM Integration Patterns
```typescript
// Standard API response format
interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

// Always stream long responses
const stream = await anthropic.messages.stream({
  model: 'claude-sonnet-4-20250514',
  messages,
  max_tokens: 1024
})

// Log token usage for cost monitoring
console.info('Token usage:', response.usage)
```

---

## Available Claude Agents

These specialized agents handle complex tasks:

| Agent | When to Use |
|-------|-------------|
| `planner` | Planning new features |
| `architect` | System design decisions |
| `tdd-guide` | Test-driven development |
| `code-reviewer` | Quality and security review |
| `security-reviewer` | Vulnerability analysis |
| `build-error-resolver` | Fix build errors |
| `e2e-runner` | Playwright E2E testing |
| `refactor-cleaner` | Dead code cleanup |
| `doc-updater` | Documentation sync |

---

## Environment Variables

```bash
# Database
DATABASE_URL=

# Vector Database (e.g., Pinecone, Qdrant, Weaviate)
VECTOR_DB_URL=
VECTOR_DB_API_KEY=

# LLM Providers
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Embedding Service
EMBEDDING_MODEL=text-embedding-3-small

# Application
NODE_ENV=development
PORT=3000
```

> NEVER commit actual API keys. Use `.env.example` as a template.

---

## Git Workflow

### Commit Messages
Use conventional commits:
- `feat:` New feature
- `fix:` Bug fix
- `refactor:` Code improvement
- `docs:` Documentation
- `test:` Tests

### Example
```bash
git commit -m "feat: add document chunking service"
git commit -m "fix: resolve embedding cache miss"
```

### Pull Request Process
1. Create feature branch from main
2. Make changes, write tests
3. Run `npm run test && npm run lint`
4. Push and create PR
5. Request review
6. Merge after approval

---

## Security Checklist

Before ANY commit, verify:
- [ ] No hardcoded secrets (API keys, passwords, tokens)
- [ ] All user inputs validated
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (sanitized HTML)
- [ ] Error messages don't leak sensitive data
- [ ] Rate limiting on API endpoints

---

## API Response Format

All APIs should return consistent responses:

```typescript
// Success
{ success: true, data: { ... } }

// Error
{ success: false, error: "User-friendly message" }
```

---

## Error Handling Pattern

```typescript
try {
  const result = await operation()
  return { success: true, data: result }
} catch (error) {
  console.error('Operation failed:', error)
  return { success: false, error: 'User-friendly message' }
}
```

---

## Context Window Management

Claude Code has a 200k token context window, but it shrinks with more tools enabled.

**Best Practices:**
- Keep under 10 MCPs (Model Context Protocol servers) enabled per project
- Use `disabledMcpServers` in project config to disable unused ones
- Keep under 80 tools active
- Use the Explore agent for codebase research instead of manual searching

---

## Performance Guidelines

1. **Batch Operations**: Group embedding requests
2. **Caching**: Cache frequently accessed data
3. **Pagination**: Limit large result sets
4. **Streaming**: Use for long LLM responses
5. **Async**: Don't block on expensive operations

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| API Rate Limits | Implement exponential backoff and caching |
| Embedding Mismatch | Ensure consistent models across indexing and querying |
| Memory Issues | Use streaming and pagination for large datasets |
| Slow Retrieval | Optimize vector database indexes |
| Build Errors | Use `/build-fix` command |

---

## Resources

### everything-claude-code
This project uses configurations from the [everything-claude-code](https://github.com/affaan-m/everything-claude-code) repository:
- Production-ready agents, skills, hooks, and commands
- Battle-tested configs from real applications
- MIT licensed - free to use and modify

### Key Files to Review
- `.claude/agents/` - Specialized task handlers
- `.claude/rules/` - Coding guidelines
- `.claude/commands/` - Custom slash commands

---

## Updating This Document

Update this CLAUDE.md when:
- New major features are added
- Development workflows change
- New conventions are established
- Dependencies significantly change
- Project structure evolves

**Keep this document accurate** - it helps Claude work effectively with the codebase.
