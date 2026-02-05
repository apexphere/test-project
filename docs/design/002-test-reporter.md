# Design Document: Test Reporter Service

| Field | Value |
|-------|-------|
| **Author** | BA/Architect (AI) |
| **Created** | 2026-02-06 |
| **Status** | 📝 Draft |
| **Pending Approval** | Master |

---

## 1. Overview

### 1.1 Problem Statement

The test automation suite produces valuable data on every run: pass/fail results, execution times, flakiness indicators, error messages, and traces. Currently this data is:
- Generated as HTML reports during CI runs
- Uploaded as artifacts to GitHub Actions
- Lost after 7 days (artifact retention)
- Not queryable or analyzable over time
- Invisible to the future `test-agent` (auto-heal) component

Without historical test data, we cannot answer critical questions:
- Which tests are flaky? (pass sometimes, fail sometimes)
- Which tests are getting slower over time?
- What's our overall test health trend?
- Which failures are regressions vs. known issues?

### 1.2 Goals

1. **Collect** test results from every Playwright run (CI and local)
2. **Store** historical test data persistently
3. **Analyze** trends: pass rates, flakiness scores, duration changes
4. **Visualize** test health via a dashboard
5. **Expose** an API for programmatic access (for future `test-agent`)
6. **Integrate** seamlessly with existing CI/CD pipeline

### 1.3 Non-Goals

- Real-time test streaming (batch processing is fine)
- Support for non-Playwright test frameworks (Playwright-first)
- Machine learning-based predictions (that's for `test-agent` later)
- Test execution/orchestration (that's `test-automation`'s job)
- Full APM/observability solution

---

## 2. Current State

### 2.1 Test Execution Flow

```
┌────────────────────────────────────────────────────────────────────┐
│                        GitHub Actions CI                            │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   PR/Push ──▶ Start SUT ──▶ Run Playwright ──▶ Upload Artifacts    │
│                               │                      │              │
│                               ▼                      ▼              │
│                        ┌──────────────┐      ┌──────────────┐      │
│                        │ test-results/│      │ playwright-  │      │
│                        │ (traces,     │      │ report/      │      │
│                        │  screenshots)│      │ (HTML)       │      │
│                        └──────────────┘      └──────────────┘      │
│                                                     │               │
│                                              Expires after 7 days   │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

### 2.2 Current Playwright Configuration

```typescript
reporter: [
  ['html'],    // HTML report → playwright-report/
  ['list']     // Console output
]
```

**Available but unused reporters:**
- `json` → Structured data we can parse
- `junit` → XML format for CI systems
- `blob` → Binary format for merging parallel runs

### 2.3 What Data is Lost

| Data Point | Captured | Stored | Queryable |
|------------|----------|--------|-----------|
| Pass/Fail result | ✅ | 7 days | ❌ |
| Test duration | ✅ | 7 days | ❌ |
| Error messages | ✅ | 7 days | ❌ |
| Stack traces | ✅ | 7 days | ❌ |
| Screenshots | ✅ | 7 days | ❌ |
| Retry count | ✅ | 7 days | ❌ |
| Historical trends | ❌ | ❌ | ❌ |
| Flakiness score | ❌ | ❌ | ❌ |

---

## 3. Target Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        GitHub Actions CI                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   PR/Push ──▶ Start SUT ──▶ Run Playwright ──▶ POST to Reporter     │
│                               │                      │               │
│                               │              ┌───────▼────────┐      │
│                               │              │  test-reporter │      │
│                               │              │    /api/runs   │      │
│                               ▼              └───────┬────────┘      │
│                        ┌──────────────┐              │               │
│                        │ JSON report  │──────────────┘               │
│                        │ (structured) │                              │
│                        └──────────────┘                              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                                                       │
                                                       ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        test-reporter service                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌────────────────────────┐ │
│  │   Ingestion  │───▶│   Storage    │───▶│   Analysis Engine      │ │
│  │   /api/runs  │    │   SQLite     │    │   • Flakiness calc     │ │
│  │              │    │   (→ PG)     │    │   • Duration trends    │ │
│  └──────────────┘    └──────────────┘    │   • Pass rate tracking │ │
│                                          └───────────┬────────────┘ │
│                                                      │               │
│  ┌──────────────────────────────────────────────────▼─────────────┐ │
│  │                      Dashboard UI                               │ │
│  │   • Test health overview          • Flaky tests list           │ │
│  │   • Pass/fail trends              • Slowest tests              │ │
│  │   • Recent runs                   • Failure details            │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                       REST API                                  │ │
│  │   GET /api/runs           GET /api/tests/:id/history           │ │
│  │   GET /api/tests          GET /api/insights/flaky              │ │
│  │   GET /api/insights       GET /api/insights/slow               │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              │                                       │
│                              ▼                                       │
│                    ┌──────────────────┐                             │
│                    │   test-agent     │  (Future: Auto-Heal)        │
│                    │   consumes API   │                             │
│                    └──────────────────┘                             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Service Design

### 4.1 Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Language | TypeScript | Project standard, type safety |
| Runtime | Node.js 20 | LTS, matches test-automation |
| Framework | Express.js | Simple, well-known, sufficient |
| Database | SQLite → PostgreSQL | Start simple, scale when needed |
| ORM | Drizzle ORM | Type-safe, lightweight, good SQLite support |
| Dashboard | Embedded HTML/CSS/JS | No build step, ships with service |
| Package Manager | pnpm | Project standard |

### 4.2 API Specification

#### Ingestion Endpoints

```yaml
POST /api/runs:
  description: Submit a new test run
  request:
    content-type: application/json
    body:
      runId: string (optional, auto-generated if omitted)
      source: string (e.g., "ci", "local")
      branch: string (optional)
      commitSha: string (optional)
      prNumber: int (optional)
      startedAt: datetime
      completedAt: datetime
      results: TestResult[]
  response:
    201:
      runId: string
      testsReceived: int
      testsStored: int
  errors:
    400: Invalid payload
    413: Payload too large (>10MB)

# TestResult schema
TestResult:
  testId: string (e.g., "auth/login.spec.ts:should login successfully")
  title: string
  file: string
  status: "passed" | "failed" | "skipped" | "timedOut"
  duration: int (milliseconds)
  retries: int
  error: object | null
    message: string
    stack: string
  annotations: string[] (optional)
```

#### Query Endpoints

```yaml
GET /api/runs:
  description: List test runs
  params:
    limit: int (default: 20, max: 100)
    offset: int (default: 0)
    branch: string (optional filter)
    status: "passed" | "failed" (optional filter)
  response:
    runs: Run[]
    total: int
    hasMore: bool

GET /api/runs/:runId:
  description: Get a specific run with all test results
  response:
    run: Run
    results: TestResult[]
    summary:
      total: int
      passed: int
      failed: int
      skipped: int
      duration: int

GET /api/tests:
  description: List all unique tests with aggregated stats
  params:
    limit: int (default: 50)
    orderBy: "flakiness" | "avgDuration" | "failRate" | "name"
    order: "asc" | "desc"
  response:
    tests: TestSummary[]

GET /api/tests/:testId/history:
  description: Get historical results for a specific test
  params:
    limit: int (default: 50)
  response:
    test: TestSummary
    history: TestResult[]

GET /api/insights/flaky:
  description: Get tests ranked by flakiness
  params:
    minRuns: int (default: 5, minimum runs to calculate)
    limit: int (default: 20)
  response:
    tests: FlakyTest[]
    
GET /api/insights/slow:
  description: Get slowest tests
  params:
    limit: int (default: 20)
  response:
    tests: SlowTest[]

GET /api/insights/overview:
  description: Dashboard overview data
  response:
    totalRuns: int
    totalTests: int
    overallPassRate: float
    trend: "improving" | "stable" | "declining"
    recentRuns: Run[] (last 10)
    topFlaky: FlakyTest[] (top 5)
    topSlow: SlowTest[] (top 5)
```

### 4.3 Data Model

```sql
-- Test Runs (one per Playwright execution)
CREATE TABLE runs (
    id TEXT PRIMARY KEY,                    -- UUID
    source TEXT NOT NULL,                   -- "ci" | "local"
    branch TEXT,
    commit_sha TEXT,
    pr_number INTEGER,
    started_at DATETIME NOT NULL,
    completed_at DATETIME NOT NULL,
    total_tests INTEGER NOT NULL,
    passed INTEGER NOT NULL,
    failed INTEGER NOT NULL,
    skipped INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Individual Test Results
CREATE TABLE test_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
    test_id TEXT NOT NULL,                  -- Stable identifier: "file:title"
    title TEXT NOT NULL,
    file TEXT NOT NULL,
    status TEXT NOT NULL,                   -- passed|failed|skipped|timedOut
    duration_ms INTEGER NOT NULL,
    retries INTEGER DEFAULT 0,
    error_message TEXT,
    error_stack TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Aggregated Test Stats (materialized for performance)
CREATE TABLE test_stats (
    test_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    file TEXT NOT NULL,
    total_runs INTEGER DEFAULT 0,
    total_passed INTEGER DEFAULT 0,
    total_failed INTEGER DEFAULT 0,
    total_skipped INTEGER DEFAULT 0,
    avg_duration_ms REAL DEFAULT 0,
    min_duration_ms INTEGER,
    max_duration_ms INTEGER,
    flakiness_score REAL DEFAULT 0,         -- 0.0 (stable) to 1.0 (very flaky)
    last_run_at DATETIME,
    last_status TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_runs_branch ON runs(branch);
CREATE INDEX idx_runs_created ON runs(created_at DESC);
CREATE INDEX idx_results_run ON test_results(run_id);
CREATE INDEX idx_results_test ON test_results(test_id);
CREATE INDEX idx_stats_flakiness ON test_stats(flakiness_score DESC);
CREATE INDEX idx_stats_duration ON test_stats(avg_duration_ms DESC);
```

### 4.4 Flakiness Calculation

A test is "flaky" when it produces inconsistent results under the same conditions.

```typescript
/**
 * Flakiness score: 0.0 (completely stable) to 1.0 (completely random)
 * 
 * Algorithm:
 * 1. Look at recent runs (default: last 20)
 * 2. Count "transitions" (pass→fail or fail→pass)
 * 3. More transitions = higher flakiness
 * 
 * Examples:
 * - [P,P,P,P,P] = 0.0 (stable pass)
 * - [F,F,F,F,F] = 0.0 (stable fail)
 * - [P,F,P,F,P] = 1.0 (maximum flakiness)
 * - [P,P,P,F,P] = 0.25 (slightly flaky)
 */
function calculateFlakiness(results: ('passed' | 'failed')[]): number {
  if (results.length < 2) return 0;
  
  let transitions = 0;
  for (let i = 1; i < results.length; i++) {
    if (results[i] !== results[i - 1]) {
      transitions++;
    }
  }
  
  // Maximum possible transitions = results.length - 1
  return transitions / (results.length - 1);
}
```

### 4.5 Dashboard UI

Simple, embedded dashboard (no React build step needed):

```
┌────────────────────────────────────────────────────────────────────┐
│  Test Reporter Dashboard                              [Branch: all]│
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │ Total Runs  │ │ Pass Rate   │ │ Total Tests │ │   Trend     │  │
│  │    147      │ │   94.2%     │ │     19      │ │     ↗       │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    Pass Rate Over Time                       │  │
│  │  100% ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─   │  │
│  │   90% ────────────────────────▲─────────────────────────────   │  │
│  │   80%                                                         │  │
│  │       Jan 20   Jan 27   Feb 03   Feb 10                      │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌─────────────────────────┐  ┌─────────────────────────────────┐ │
│  │    🔥 Flaky Tests       │  │    🐢 Slowest Tests             │ │
│  │                         │  │                                  │ │
│  │  1. login timeout (0.45)│  │  1. product search (12.3s)      │ │
│  │  2. cart update (0.30)  │  │  2. checkout flow (8.7s)        │ │
│  │  3. search filter (0.20)│  │  3. login with 2FA (6.2s)       │ │
│  └─────────────────────────┘  └─────────────────────────────────┘ │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                     Recent Runs                              │  │
│  │                                                              │  │
│  │  #147  develop  abc123  ✅ 19/19 passed  2m 34s  5 min ago  │  │
│  │  #146  develop  def456  ❌ 17/19 passed  2m 45s  1 hr ago   │  │
│  │  #145  feature  ghi789  ✅ 19/19 passed  2m 30s  2 hr ago   │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

---

## 5. Integration Points

### 5.1 Playwright Integration

**Option A: Custom Reporter (Recommended)**

Create a custom Playwright reporter that POSTs results to test-reporter:

```typescript
// test-automation/reporters/test-reporter.ts
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';

class TestReporterReporter implements Reporter {
  private results: TestResult[] = [];
  private startTime: Date;
  
  onBegin() {
    this.startTime = new Date();
  }
  
  onTestEnd(test: TestCase, result: TestResult) {
    this.results.push({
      testId: `${test.location.file}:${test.title}`,
      title: test.title,
      file: test.location.file,
      status: result.status,
      duration: result.duration,
      retries: result.retry,
      error: result.error ? {
        message: result.error.message,
        stack: result.error.stack
      } : null
    });
  }
  
  async onEnd() {
    await fetch(`${process.env.TEST_REPORTER_URL}/api/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: process.env.CI ? 'ci' : 'local',
        branch: process.env.GITHUB_REF_NAME,
        commitSha: process.env.GITHUB_SHA,
        prNumber: process.env.GITHUB_PR_NUMBER,
        startedAt: this.startTime.toISOString(),
        completedAt: new Date().toISOString(),
        results: this.results
      })
    });
  }
}

export default TestReporterReporter;
```

**Updated playwright.config.ts:**

```typescript
reporter: [
  ['html'],
  ['list'],
  ['./reporters/test-reporter.ts']  // Add custom reporter
]
```

### 5.2 CI/CD Integration

**Option A: Reporter + Service in CI (Recommended for now)**

```yaml
# .github/workflows/ci.yml additions

- name: Start test-reporter
  run: |
    cd test-reporter
    npm ci
    npm run start &
    sleep 5  # Wait for service to start
  env:
    PORT: 3000
    DATABASE_PATH: ./test-reporter.db

- name: Run Playwright tests
  run: |
    cd test-automation
    npx playwright test
  env:
    TEST_REPORTER_URL: http://localhost:3000

- name: Upload test-reporter database
  uses: actions/upload-artifact@v4
  if: always()
  with:
    name: test-reporter-db
    path: test-reporter/test-reporter.db
```

**Option B: Hosted Service (Future)**

When we have persistent infrastructure:
- Deploy test-reporter as a service (k8s or cloud)
- CI pushes results to the hosted service
- Data persists across all runs

### 5.3 Future test-agent Integration

The test-agent will consume the API to:

```typescript
// test-agent pseudocode

// 1. Find flaky tests to investigate
const flakyTests = await fetch('/api/insights/flaky?limit=10');

// 2. Get history for a specific test
const history = await fetch(`/api/tests/${testId}/history`);

// 3. Analyze failure patterns
const failingTests = history.filter(r => r.status === 'failed');
const errorPatterns = analyzeErrors(failingTests);

// 4. Suggest fixes based on patterns
const suggestions = generateFixSuggestions(errorPatterns);
```

---

## 6. Deployment Design

### 6.1 Phase 1: Local/CI (SQLite)

```
test-project/
├── test-reporter/
│   ├── src/
│   │   ├── index.ts           # Express app entry
│   │   ├── routes/
│   │   │   ├── runs.ts
│   │   │   ├── tests.ts
│   │   │   └── insights.ts
│   │   ├── db/
│   │   │   ├── schema.ts      # Drizzle schema
│   │   │   └── migrations/
│   │   ├── services/
│   │   │   ├── ingestion.ts
│   │   │   └── analysis.ts
│   │   └── dashboard/
│   │       └── index.html     # Static dashboard
│   ├── package.json
│   ├── tsconfig.json
│   └── test-reporter.db       # SQLite (gitignored)
└── test-automation/
    ├── reporters/
    │   └── test-reporter.ts   # Custom reporter
    └── playwright.config.ts
```

### 6.2 Phase 2: Kubernetes (PostgreSQL)

```yaml
# k8s/base/test-reporter/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: test-reporter
spec:
  replicas: 1
  template:
    spec:
      containers:
        - name: test-reporter
          image: test-reporter:latest
          ports:
            - containerPort: 3000
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: test-reporter-secrets
                  key: database-url
```

### 6.3 Resource Requirements

| Phase | Database | Memory | CPU | Storage |
|-------|----------|--------|-----|---------|
| 1 (Local/CI) | SQLite | 128Mi | 0.1 | 100MB |
| 2 (K8s) | PostgreSQL | 256Mi | 0.2 | 1GB |

---

## 7. Implementation Plan

### Phase 1: Core Service (Est: 4-6 hours)

1. Initialize `test-reporter/` with TypeScript + Express
2. Set up Drizzle ORM with SQLite
3. Implement data model (runs, test_results, test_stats)
4. Implement POST /api/runs endpoint
5. Implement GET /api/runs, /api/tests endpoints
6. Add basic tests

### Phase 2: Playwright Integration (Est: 2-3 hours)

1. Create custom Playwright reporter
2. Update playwright.config.ts
3. Test locally with manual runs
4. Verify data flows correctly

### Phase 3: Analysis & Insights (Est: 3-4 hours)

1. Implement flakiness calculation
2. Implement duration trend tracking
3. Add /api/insights/* endpoints
4. Add test_stats materialization trigger

### Phase 4: Dashboard UI (Est: 3-4 hours)

1. Create static HTML dashboard
2. Add CSS styling (keep it simple)
3. Add JavaScript for fetching data
4. Add basic charts (pass rate over time)

### Phase 5: CI Integration (Est: 2-3 hours)

1. Update GitHub Actions workflow
2. Add test-reporter startup
3. Configure artifact upload for DB
4. Test end-to-end in CI

### Phase 6: Documentation & Polish (Est: 1-2 hours)

1. Write README for test-reporter
2. Document API endpoints
3. Add usage examples
4. Update project README

**Total Estimate: 15-22 hours**

---

## 8. Testing Strategy

### 8.1 Unit Tests

- Ingestion service: validate payload parsing
- Analysis service: flakiness calculation, trend detection
- Database operations: CRUD operations

### 8.2 Integration Tests

- API endpoint tests (supertest)
- Database migrations
- Reporter → API flow

### 8.3 Manual Validation

- Run Playwright tests locally → verify data appears
- Check dashboard renders correctly
- Verify flakiness scores make sense

---

## 9. Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Data loss (CI ephemeral) | Medium | High | Start with artifact upload; move to hosted DB later |
| Performance at scale | Low | Low | SQLite handles thousands of runs; optimize when needed |
| Complex dashboard | Medium | Medium | Keep it simple—HTML/CSS/JS, no build step |
| CI job timeout | Medium | Low | Reporter is fire-and-forget; timeout handling |
| Breaking Playwright upgrade | Low | Low | Minimal reporter surface; pin Playwright version |

---

## 10. Decisions (Pending Approval)

### 10.1 Database Choice

**Question:** SQLite (simple) or PostgreSQL (scalable) from the start?

**Recommendation:** SQLite for Phase 1

- Rationale: No infrastructure needed, file-based, easy to start
- Migration path: Drizzle ORM supports both; schema stays the same
- Trade-off: Loses data between CI runs (mitigated by artifact upload)

**Decision:** 🔲 Pending

### 10.2 Dashboard Approach

**Question:** Static HTML, React SPA, or API-only?

**Recommendation:** Static HTML dashboard

- Rationale: No build step, ships with service, minimal complexity
- Trade-off: Less interactive than React
- Future: Can add React dashboard later if needed

**Decision:** 🔲 Pending

### 10.3 Where Does test-reporter Run?

**Question:** CI-only, standalone service, or both?

**Recommendation:** CI-only first, standalone service later

- Phase 1: Runs in CI, stores to SQLite, uploads as artifact
- Phase 2: Hosted service in K8s, permanent storage
- Rationale: Get value quickly without infrastructure overhead

**Decision:** 🔲 Pending

### 10.4 Retention Policy

**Question:** How long to keep test data?

**Recommendation:** 90 days initially

- Recent data is most valuable
- Storage is cheap but not free
- Can extend later if needed

**Decision:** 🔲 Pending

---

## 11. Success Criteria

- [ ] test-reporter service runs and accepts POST /api/runs
- [ ] Custom Playwright reporter sends results to test-reporter
- [ ] API returns test runs, individual test history
- [ ] Flakiness scores are calculated and queryable
- [ ] Dashboard displays test health overview
- [ ] CI pipeline integrates test-reporter
- [ ] Data persists across CI runs (artifact or hosted)
- [ ] Documentation is complete
- [ ] All existing E2E tests still pass

---

## 12. Appendix

### A. Playwright JSON Report Structure

```json
{
  "config": { ... },
  "suites": [
    {
      "title": "auth/login.spec.ts",
      "file": "tests/auth/login.spec.ts",
      "specs": [
        {
          "title": "should login successfully",
          "ok": true,
          "tests": [
            {
              "projectName": "chromium",
              "status": "expected",
              "duration": 2345,
              "results": [
                {
                  "status": "passed",
                  "duration": 2345,
                  "retry": 0
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

### B. Example API Usage

```bash
# Submit a test run
curl -X POST http://localhost:3000/api/runs \
  -H "Content-Type: application/json" \
  -d '{
    "source": "local",
    "branch": "develop",
    "startedAt": "2026-02-06T10:00:00Z",
    "completedAt": "2026-02-06T10:02:30Z",
    "results": [
      {
        "testId": "auth/login.spec.ts:should login successfully",
        "title": "should login successfully",
        "file": "auth/login.spec.ts",
        "status": "passed",
        "duration": 2345,
        "retries": 0
      }
    ]
  }'

# Get flaky tests
curl http://localhost:3000/api/insights/flaky

# Get test history
curl http://localhost:3000/api/tests/auth%2Flogin.spec.ts%3Ashould%20login%20successfully/history
```

### C. Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | HTTP server port | 3000 |
| `DATABASE_PATH` | SQLite file path | ./test-reporter.db |
| `DATABASE_URL` | PostgreSQL URL (Phase 2) | - |
| `LOG_LEVEL` | Logging level | info |
| `RETENTION_DAYS` | Data retention period | 90 |

### D. Directory Structure

```
test-reporter/
├── src/
│   ├── index.ts              # App entry point
│   ├── config.ts             # Environment config
│   ├── routes/
│   │   ├── index.ts          # Route aggregator
│   │   ├── runs.ts           # /api/runs endpoints
│   │   ├── tests.ts          # /api/tests endpoints
│   │   └── insights.ts       # /api/insights endpoints
│   ├── db/
│   │   ├── index.ts          # Database connection
│   │   ├── schema.ts         # Drizzle schema
│   │   └── migrations/       # SQL migrations
│   ├── services/
│   │   ├── ingestion.ts      # Process incoming runs
│   │   ├── analysis.ts       # Calculate metrics
│   │   └── stats.ts          # Update test_stats
│   └── dashboard/
│       ├── index.html        # Main dashboard
│       ├── styles.css        # Dashboard styles
│       └── app.js            # Dashboard JavaScript
├── tests/
│   ├── routes.test.ts
│   └── services.test.ts
├── package.json
├── tsconfig.json
├── drizzle.config.ts
└── README.md
```

---

*End of Design Document*
