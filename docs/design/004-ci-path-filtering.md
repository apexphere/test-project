# Design Doc 004: CI Path-Filtering Optimization

**Author:** Riley 📐 (BA/Architect)  
**Date:** 2026-02-08  
**Status:** Draft  
**RFC:** Open for review

---

## Overview

This document specifies the implementation of path-based filtering for our CI/CD pipelines. By intelligently skipping jobs that don't need to run based on which files changed, we can significantly reduce CI runtime and resource consumption.

### Goals

| Goal | Target |
|------|--------|
| Reduce unnecessary CI runs | 40-60% reduction in total job executions |
| Faster feedback loops | Skip irrelevant jobs → faster green builds |
| Lower costs | Reduced GitHub Actions minutes usage |
| Maintain reliability | Never skip jobs that should run |

### Non-Goals

- Changing the actual test/build logic
- Modifying deployment pipelines (separate initiative)
- Parallelization improvements (orthogonal concern)

---

## Path Filter Mappings

The following table defines which paths trigger which CI jobs:

| Path Pattern | Triggered Jobs | Rationale |
|--------------|----------------|-----------|
| `sut/**` | `build`, `test-unit`, `test-integration`, `lint` | Core application code changes |
| `test-reporter/**` | `test-reporter-build`, `test-reporter-test` | Reporter tooling only |
| `test-automation/**` | `test-e2e`, `test-automation-lint` | E2E test framework changes |
| `docs/**` | `docs-build`, `docs-lint` | Documentation only - skip all app CI |
| `.github/workflows/**` | **ALL JOBS** | Workflow changes must run full CI |
| `package.json`, `pnpm-lock.yaml` | `build`, `test-*`, `lint` | Dependency changes affect everything |

### Special Patterns

```yaml
# Root config files that affect everything
global_triggers:
  - 'package.json'
  - 'pnpm-lock.yaml'
  - 'tsconfig*.json'
  - '.eslintrc*'
  - '.prettierrc*'
```

---

## Job Dependency Diagram

```
                    ┌─────────────────┐
                    │  paths-filter   │
                    │   (dorny/v3)    │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
    ┌─────────┐        ┌───────────┐      ┌───────────┐
    │sut: true│        │test-auto: │      │docs: true │
    │         │        │   true    │      │           │
    └────┬────┘        └─────┬─────┘      └─────┬─────┘
         │                   │                  │
    ┌────┴────┐              │                  │
    │         │              │                  │
    ▼         ▼              ▼                  ▼
┌──────┐  ┌──────┐     ┌──────────┐      ┌───────────┐
│build │  │ lint │     │ test-e2e │      │ docs-build│
└──┬───┘  └──────┘     └──────────┘      └───────────┘
   │
   ├──────────────┐
   ▼              ▼
┌──────────┐  ┌────────────────┐
│test-unit │  │test-integration│
└──────────┘  └────────────────┘
```

---

## Implementation

### Using `dorny/paths-filter@v3`

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  changes:
    runs-on: ubuntu-latest
    outputs:
      sut: ${{ steps.filter.outputs.sut }}
      test-automation: ${{ steps.filter.outputs.test-automation }}
      test-reporter: ${{ steps.filter.outputs.test-reporter }}
      docs: ${{ steps.filter.outputs.docs }}
      global: ${{ steps.filter.outputs.global }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            sut:
              - 'sut/**'
            test-automation:
              - 'test-automation/**'
            test-reporter:
              - 'test-reporter/**'
            docs:
              - 'docs/**'
            global:
              - 'package.json'
              - 'pnpm-lock.yaml'
              - 'tsconfig*.json'
              - '.github/workflows/**'

  build:
    needs: changes
    if: ${{ needs.changes.outputs.sut == 'true' || needs.changes.outputs.global == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build
        run: pnpm build

  test-unit:
    needs: [changes, build]
    if: ${{ needs.changes.outputs.sut == 'true' || needs.changes.outputs.global == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Test
        run: pnpm test:unit

  test-e2e:
    needs: changes
    if: ${{ needs.changes.outputs.test-automation == 'true' || needs.changes.outputs.sut == 'true' || needs.changes.outputs.global == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: E2E Tests
        run: pnpm test:e2e

  docs-build:
    needs: changes
    if: ${{ needs.changes.outputs.docs == 'true' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build Docs
        run: pnpm docs:build
```

---

## Edge Cases

### 1. Multiple Paths Changed

When a PR touches multiple paths (e.g., `sut/**` AND `docs/**`), all corresponding jobs run. The `||` conditions in job `if` statements handle this naturally.

### 2. Workflow File Changes

Any change to `.github/workflows/**` triggers ALL jobs via the `global` filter. This ensures workflow changes are tested against the full suite.

### 3. New Files Outside Known Paths

Files created outside mapped paths (e.g., a new `/scripts` directory) won't trigger any jobs by default. **Mitigation:** Add a catch-all that triggers on unknown paths:

```yaml
unknown:
  - '**'
  - '!sut/**'
  - '!test-automation/**'
  - '!test-reporter/**'
  - '!docs/**'
```

### 4. Empty Commits / Merge Commits

`dorny/paths-filter` handles these correctly by comparing against the base branch for PRs and the previous commit for pushes.

### 5. Force Pushes

Force pushes recalculate the diff from scratch - no special handling needed.

### 6. Renovate/Dependabot PRs

Dependency updates will trigger `global` patterns (`package.json`, `pnpm-lock.yaml`), correctly running full CI.

---

## Rollout Plan

### Phase 1: Shadow Mode (Week 1)
- Deploy path filtering but **don't skip jobs**
- Add logging to track what *would* be skipped
- Validate filter accuracy against actual test failures

### Phase 2: Docs-Only (Week 2)
- Enable filtering for `docs/**` changes only
- Low risk: docs changes rarely break app builds
- Monitor for false negatives

### Phase 3: Test Components (Week 3)
- Enable for `test-reporter/**` and `test-automation/**`
- These are isolated components with clear boundaries

### Phase 4: Full Rollout (Week 4)
- Enable for `sut/**` (core application)
- Full path filtering active
- Keep escape hatch: `[ci full]` in commit message forces all jobs

### Rollback Trigger

Immediately rollback if:
- Any false negative (skipped job that should have caught a bug)
- >5% increase in post-merge failures
- Team concerns about confidence

---

## Success Metrics

| Metric | Baseline | Target (30 days) |
|--------|----------|------------------|
| Total CI job runs/week | ~500 | ~250 (50% reduction) |
| Avg PR feedback time | 12 min | 6 min |
| GitHub Actions minutes/month | 2000 | 1000 |
| False negative rate | N/A | <0.1% |

---

## References

- [dorny/paths-filter documentation](https://github.com/dorny/paths-filter)
- [GitHub Actions workflow syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- Internal: ADR-003 (CI/CD Architecture)
