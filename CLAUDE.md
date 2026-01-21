# CLAUDE.md - AI Assistant Guide for RAGbox.co

## Project Overview

**RAGbox.co** is a Retrieval-Augmented Generation (RAG) application. This document provides guidance for AI assistants working on this codebase.

> **Note**: This is a new repository. Update this document as the codebase evolves.

---

## Repository Status

- **Current State**: Empty/Initial Setup
- **Last Updated**: January 2026

---

## Quick Reference

| Command | Description |
|---------|-------------|
| `npm install` | Install dependencies |
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run test` | Run test suite |
| `npm run lint` | Run linter |

> Update this table as scripts are added to package.json

---

## Project Structure

```
RAGbox.co/
├── CLAUDE.md           # This file - AI assistant guide
├── README.md           # Project documentation
├── package.json        # Dependencies and scripts
├── src/                # Source code
│   ├── api/            # API routes and handlers
│   ├── components/     # UI components
│   ├── lib/            # Shared utilities
│   ├── services/       # Business logic
│   │   ├── embedding/  # Vector embedding services
│   │   ├── retrieval/  # Document retrieval logic
│   │   └── generation/ # LLM generation services
│   └── types/          # TypeScript type definitions
├── tests/              # Test files
├── docs/               # Documentation
└── config/             # Configuration files
```

> Update this structure as the project develops

---

## Development Workflows

### Setting Up the Development Environment

1. Clone the repository
2. Install dependencies: `npm install`
3. Copy environment template: `cp .env.example .env`
4. Configure API keys and database connections in `.env`
5. Start development server: `npm run dev`

### Making Changes

1. Create a feature branch from main
2. Make changes following the code style guidelines
3. Run tests: `npm run test`
4. Run linter: `npm run lint`
5. Commit with descriptive messages
6. Push and create a pull request

### Testing

- Write tests for all new features
- Maintain test coverage above 80%
- Run tests before committing

---

## Code Conventions

### General Principles

- **Keep it simple**: Avoid over-engineering
- **Be explicit**: Prefer clarity over cleverness
- **Stay consistent**: Follow existing patterns in the codebase
- **Document intentionally**: Add comments only where logic isn't self-evident

### TypeScript Guidelines

- Use strict TypeScript configuration
- Define explicit types for function parameters and return values
- Prefer interfaces over type aliases for object shapes
- Use enums for fixed sets of values

### File Naming

- Use kebab-case for file names: `user-service.ts`
- Use PascalCase for component files: `UserProfile.tsx`
- Use `.test.ts` or `.spec.ts` suffix for test files

### Code Style

- Use 2 spaces for indentation
- Use single quotes for strings
- Always use semicolons
- Maximum line length: 100 characters

---

## RAG-Specific Guidelines

### Embedding Services

- Use consistent embedding models across the application
- Cache embeddings when possible to reduce API costs
- Handle rate limiting gracefully with exponential backoff

### Vector Database

- Keep chunk sizes consistent (typically 500-1000 tokens)
- Include relevant metadata with each vector
- Use appropriate similarity thresholds for retrieval

### LLM Integration

- Use system prompts to establish context
- Implement proper error handling for API failures
- Log token usage for cost monitoring
- Stream responses when possible for better UX

### Prompt Engineering

- Keep prompts in separate, version-controlled files
- Use template literals for dynamic content
- Test prompts with diverse inputs
- Document prompt versions and changes

---

## Environment Variables

```bash
# Database
DATABASE_URL=

# Vector Database
VECTOR_DB_URL=
VECTOR_DB_API_KEY=

# LLM Provider
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Embedding Service
EMBEDDING_MODEL=
EMBEDDING_API_KEY=

# Application
NODE_ENV=development
PORT=3000
```

> Never commit actual API keys. Use `.env.example` as a template.

---

## Common Tasks for AI Assistants

### When Adding New Features

1. Check existing patterns in the codebase
2. Follow the established file structure
3. Add appropriate types
4. Write tests for new functionality
5. Update documentation if needed

### When Fixing Bugs

1. Read the relevant code before making changes
2. Understand the context and dependencies
3. Make minimal, focused changes
4. Add tests to prevent regression
5. Verify the fix doesn't break existing functionality

### When Refactoring

1. Ensure tests exist before refactoring
2. Make incremental changes
3. Run tests after each change
4. Don't mix refactoring with feature changes

---

## Security Considerations

- Never hardcode secrets or API keys
- Validate and sanitize all user inputs
- Use parameterized queries for database operations
- Implement proper authentication and authorization
- Sanitize data before embedding to prevent injection
- Rate limit API endpoints

---

## Performance Guidelines

- Batch embedding requests when possible
- Use caching for frequently accessed data
- Implement pagination for large result sets
- Monitor and optimize slow queries
- Use streaming for long-running LLM responses

---

## Dependencies

> Update this section as dependencies are added

### Core Dependencies

- (To be added as project develops)

### Dev Dependencies

- (To be added as project develops)

---

## Troubleshooting

### Common Issues

1. **API Rate Limits**: Implement exponential backoff and caching
2. **Embedding Mismatch**: Ensure consistent models across indexing and querying
3. **Memory Issues**: Use streaming and pagination for large datasets
4. **Slow Retrieval**: Optimize vector database indexes and query parameters

---

## Contributing

1. Follow the code conventions in this document
2. Write meaningful commit messages
3. Keep pull requests focused and small
4. Request reviews from team members
5. Address review comments promptly

---

## Updating This Document

This CLAUDE.md should be updated when:

- New major features are added
- Development workflows change
- New conventions are established
- Dependencies are significantly changed
- Project structure evolves

Keep this document accurate and up-to-date to help AI assistants work effectively with the codebase.
