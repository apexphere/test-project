# Quality Strategy

| Field | Value |
|-------|-------|
| **Author** | Megan (AI) |
| **Created** | 2026-02-06 |
| **Status** | 📋 Proposed |
| **Issue** | #16 |

---

## 1. Overview

### 1.1 Problem Statement

Our current quality gate relies solely on E2E tests (Playwright). This is problematic:
- **PR #9 incident:** Merged despite failing CI because E2E tests are slow and flaky
- **No fast feedback:** Developers wait minutes for test results
- **Poor failure isolation:** "Something broke" vs "this function broke"

### 1.2 Goals

1. Establish a proper test pyramid
2. Define quality gates that are fast and reliable
3. Prevent broken code from merging
4. Give developers fast feedback

### 1.3 Current State

| Layer | Tests | Framework | CI Gate? |
|-------|-------|-----------|----------|
| Unit | 0 | — | ❌ |
| Integration | 0 | — | ❌ |
| E2E | 24 | Playwright | ✅ (slow, flaky) |

---

## 2. Test Pyramid

```
            /\
           /  \         E2E (Playwright)
          / 10%\        - 8 smoke tests on PR
         /------\       - Full 24 nightly
        /        \
       /   20%    \     Integration
      /            \    - API contracts
     /--------------\   - Service boundaries
    /                \
   /       70%        \ Unit
  /                    \- pytest (backend)
 /______________________\- Vitest (frontend)
```

### Industry Best Practice

| Layer | Percentage | Speed | Reliability | Isolation |
|-------|------------|-------|-------------|-----------|
| Unit | 70% | ms | High | Excellent |
| Integration | 20% | seconds | Medium | Good |
| E2E | 10% | minutes | Lower | Poor |

**Key insight:** Fast, reliable tests at the bottom; slow, comprehensive tests at the top.

---

## 3. Recommended Test Strategy

### 3.1 Unit Tests

**Backend (Python/FastAPI)**
- Framework: **pytest**
- Coverage target: 80%+
- What to test:
  - Business logic functions
  - Data validation
  - Utility functions
  - Model methods

**Frontend (React/TypeScript)**
- Framework: **Vitest** (faster than Jest, Vite-native)
- Coverage target: 70%+
- What to test:
  - Utility functions
  - Hooks
  - State logic
  - Component rendering (with React Testing Library)

### 3.2 Integration Tests

- Framework: **pytest** (backend), **Vitest** (frontend)
- What to test:
  - API endpoint contracts
  - Database interactions
  - Service-to-service calls (e.g., backend → auth service)
  - Authentication flow

### 3.3 E2E Tests

- Framework: **Playwright** (already in place)
- Strategy: **Smoke tests for PR gate, full suite nightly**

| Tag | Count | When | Purpose |
|-----|-------|------|---------|
| `@smoke` | 8 | Every PR | Critical paths only |
| `@full` | 24 | Nightly | Comprehensive coverage |

**Smoke tests should cover:**
1. User can register
2. User can login
3. User can view products
4. User can add to cart
5. User can checkout (if implemented)
6. User can logout
7. Auth service health
8. Backend API health

---

## 4. Quality Gates

### 4.1 PR Merge Requirements

| Check | Required | Target Time |
|-------|----------|-------------|
| Unit tests pass | ✅ Yes | <2 min |
| Integration tests pass | ✅ Yes | <3 min |
| E2E smoke tests pass | ✅ Yes | <5 min |
| **Total** | — | **<10 min** |

### 4.2 Branch Protection Rules

```json
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Unit Tests",
      "Integration Tests", 
      "E2E Smoke Tests"
    ]
  }
}
```

### 4.3 CI Pipeline Structure

```yaml
# Fast feedback first
jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - run: pytest tests/unit --fast
      - run: pnpm test:unit
    # Target: <2 min

  integration-tests:
    needs: unit-tests
    steps:
      - run: pytest tests/integration
      - run: pnpm test:integration
    # Target: <3 min

  e2e-smoke:
    needs: integration-tests
    steps:
      - run: pnpm playwright test --grep @smoke
    # Target: <5 min

  # Nightly only
  e2e-full:
    if: github.event_name == 'schedule'
    steps:
      - run: pnpm playwright test
```

---

## 5. Gap Analysis

### What's Missing

| Gap | Impact | Priority |
|-----|--------|----------|
| No unit tests (backend) | No fast feedback for Python code | 🔴 High |
| No unit tests (frontend) | No fast feedback for React code | 🔴 High |
| No integration tests | Service boundaries untested | 🟡 Medium |
| E2E not tagged | Can't run smoke subset | 🟡 Medium |
| CI runs full E2E on every PR | Slow, flaky | 🟡 Medium |

### Root Cause of PR #9 Incident

1. Only quality gate was slow E2E tests
2. Tests failed, but merge wasn't blocked (no branch protection)
3. No fast feedback loop to catch issues earlier
4. Developer merged anyway because "tests are flaky"

---

## 6. Implementation Plan

### Phase 1: Foundation (Week 1-2)

| Task | Effort | Owner |
|------|--------|-------|
| ✅ Enable branch protection | Done | — |
| Add pytest setup to backend | 2 days | Dev |
| Write 20 unit tests for core services | 3 days | Dev |
| Add Vitest setup to frontend | 1 day | Dev |
| Write 10 unit tests for utilities | 2 days | Dev |

### Phase 2: Integration (Week 3-4)

| Task | Effort | Owner |
|------|--------|-------|
| Add integration test structure | 1 day | Dev |
| Write API contract tests | 2 days | Dev |
| Write auth service integration tests | 2 days | Dev |
| Update CI pipeline | 1 day | Dev |

### Phase 3: E2E Optimization (Week 5-6)

| Task | Effort | Owner |
|------|--------|-------|
| Tag 8 tests as @smoke | 0.5 days | Tester |
| Configure smoke vs full runs | 0.5 days | Dev |
| Add nightly full E2E run | 0.5 days | Dev |
| Monitor and tune flaky tests | Ongoing | Tester |

### Total Effort

~22 dev-days over 6 weeks

---

## 7. Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| PR feedback time | ~10 min | <10 min |
| Unit test coverage (backend) | 0% | 80% |
| Unit test coverage (frontend) | 0% | 70% |
| Flaky test rate | Unknown | <5% |
| PRs merged with failing CI | Yes (PR #9) | 0 |

---

## 8. Decisions

### 8.1 Unit Test Framework (Backend)
- **Decision:** pytest
- **Rationale:** Industry standard for Python, already used by FastAPI community

### 8.2 Unit Test Framework (Frontend)
- **Decision:** Vitest
- **Rationale:** Vite-native (our stack), faster than Jest, compatible API

### 8.3 E2E Strategy
- **Decision:** Smoke on PR, full nightly
- **Rationale:** Balance fast feedback with comprehensive coverage

### 8.4 Coverage Thresholds
- **Decision:** 80% backend, 70% frontend (not enforced initially)
- **Rationale:** Start measuring, enforce later when baseline established

---

## 9. References

- [Google Testing Blog: Test Pyramid](https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html)
- [Martin Fowler: Test Pyramid](https://martinfowler.com/bliki/TestPyramid.html)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)

---

*End of Quality Strategy*
