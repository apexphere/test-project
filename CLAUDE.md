# CLAUDE.md — Test Automation Platform

> This file provides context for Claude to work effectively on this project.

## Project Overview

An intelligent test automation platform with self-healing capabilities.

### Architecture Layers

```
┌─────────────────────────────┐
│      Auto-Heal (AI)         │  ← Smart layer
├─────────────────────────────┤
│   Analysis & Insights       │  ← Intelligence
├─────────────────────────────┤
│   Result Tracking & History │  ← Visibility
├─────────────────────────────┤
│   Test Execution Engine     │  ← Foundation
├─────────────────────────────┤
│   Test Data Management      │  ← Support layer
└─────────────────────────────┘
```

### Sub-Projects (Planned)

| Project | Purpose | Status |
|---------|---------|--------|
| `test-automation/` | Core Playwright test suite | 🚧 Planning |
| `test-reporter/` | Result tracking & analysis | 📋 Planned |
| `test-data-manager/` | Test data & fixtures management | 📋 Planned |
| `test-agent/` | AI-powered auto-heal agent | 📋 Planned |

## Tech Stack

### Languages
- **TypeScript** — Primary language for all projects
- **Node.js** — Runtime environment

### Frameworks
- **Playwright** — E2E/integration testing
- **Jest** — Unit testing
- **Database** — TBD (start with JSON/SQLite, scale later)

### Tools
- **pnpm** — Package manager (preferred over npm/yarn)
- **ESLint** — Linting
- **Prettier** — Formatting

## Code Conventions

### TypeScript
- Strict mode enabled
- Prefer `interface` over `type` for object shapes
- Use explicit return types on functions
- No `any` — use `unknown` if type is truly unknown

### File Structure
```
project/
├── src/           # Source code
├── tests/         # Test files
│   ├── unit/      # Jest unit tests
│   └── e2e/       # Playwright E2E tests
├── docs/          # Documentation
└── scripts/       # Utility scripts
```

### Naming
- Files: `kebab-case.ts`
- Classes: `PascalCase`
- Functions/variables: `camelCase`
- Constants: `UPPER_SNAKE_CASE`
- Test files: `*.test.ts` (unit), `*.spec.ts` (e2e)

## Git Workflow

### Branch Strategy
- `main` — Production-ready code
- `develop` — Integration branch
- `feature/*` — New features
- `fix/*` — Bug fixes
- `refactor/*` — Code improvements

### Commit Convention (Conventional Commits)
```
type(scope): description

Types: feat, fix, docs, style, refactor, test, chore
```

Examples:
- `feat(automation): add login test suite`
- `fix(reporter): correct timestamp parsing`
- `docs: update README with setup instructions`

### Claude Git Operations
Claude is authorized to:
- ✅ Create feature/fix branches
- ✅ Make commits with conventional commit messages
- ✅ Push to feature branches
- ⚠️ Ask before pushing to `main` or `develop`
- ⚠️ Ask before force pushing

## Development Principles

1. **Start small, iterate** — Don't over-engineer upfront
2. **Tests for tests** — Even test utilities should have tests
3. **Document as you go** — Comments for why, not what
4. **Fail fast** — Clear error messages over silent failures

## Learned Rules

> This section is updated as we learn project-specific patterns.

*(Empty — will be populated as development progresses)*

---

*Last updated: 2026-02-04*
