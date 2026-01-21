# Claude Code Configuration

This directory contains configurations that make Claude Code work smarter for RAGbox.co.

## What's Here

### /agents
Specialized helpers for specific tasks:
- **planner.md** - Creates detailed implementation plans
- **code-reviewer.md** - Reviews code quality and security
- **security-reviewer.md** - Analyzes security vulnerabilities
- **build-error-resolver.md** - Fixes build errors

### /commands
Quick slash commands you can use:
- **/plan** - Plan before implementing
- **/code-review** - Review code quality
- **/build-fix** - Fix build errors
- **/tdd** - Test-driven development

### /rules
Guidelines Claude always follows:
- **security.md** - Security best practices
- **coding-style.md** - Code formatting rules
- **testing.md** - Testing requirements
- **git-workflow.md** - Git conventions

### /skills
Domain knowledge for coding:
- **coding-standards.md** - Best practices
- **backend-patterns.md** - API and database patterns

## How to Use

These configs work automatically. Just use the commands:

```
/plan         - Before starting a new feature
/code-review  - To check code quality
/build-fix    - When builds fail
/tdd          - For test-driven development
```

## Source

Configs from [everything-claude-code](https://github.com/affaan-m/everything-claude-code) by @affaan-m.
