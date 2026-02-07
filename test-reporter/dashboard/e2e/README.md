# Dashboard E2E Tests

End-to-end tests for the test-reporter dashboard using Playwright.

## Prerequisites

- Docker and Docker Compose (for backend + database)
- Node.js 20+
- pnpm

## Running Tests

### 1. Start Backend Services

```bash
# From test-reporter directory
cd /path/to/test-reporter

# Start postgres and backend
docker-compose up -d postgres server-dev
# Or for production mode:
# docker-compose up -d postgres server

# Wait for services to be ready
curl http://localhost:3000/api/health
```

### 2. Start Dashboard Dev Server

```bash
cd dashboard
pnpm dev
```

### 3. Run E2E Tests

```bash
# In another terminal, from dashboard directory
cd dashboard

# Run all tests
pnpm test:e2e

# Run tests with UI
pnpm test:e2e:ui

# View test report
pnpm test:e2e:report
```

## Test Coverage

The E2E tests cover the following critical user flows:

### Dashboard Page
- ✅ Dashboard loads and shows stats cards (Total Runs, Pass Rate, Total Tests, Trend)
- ✅ Pass rate chart renders correctly
- ✅ Flaky tests list displays
- ✅ Slowest tests list displays
- ✅ Recent runs table displays

### Navigation
- ✅ Click run row → navigates to Run Detail
- ✅ Click test row → navigates to Test Detail
- ✅ Click test in slowest list → navigates to Test Detail
- ✅ Breadcrumb navigation works
- ✅ Header logo navigates home

### Run Detail Page
- ✅ Run info displays correctly (source, branch, commit, time)
- ✅ Test stats display (total, passed, failed, skipped, pass rate)
- ✅ Filter tabs work (All/Passed/Failed/Skipped)
- ✅ Test results table displays
- ✅ Click test row → navigates to Test Detail

### Test Detail Page
- ✅ Test stats display (runs, pass rate, flakiness, duration)
- ✅ Duration chart renders
- ✅ Run history table displays
- ✅ Test title and file shown
- ✅ Navigate to run from history

### Data Display
- ✅ Status badges display correctly
- ✅ Durations are formatted correctly
- ✅ Tables have proper structure

## CI Integration

The tests can be run in CI by starting the backend with Docker Compose:

```yaml
# Example GitHub Actions step
- name: Start services
  run: |
    cd test-reporter
    docker-compose up -d postgres server
    # Wait for API
    timeout 30 sh -c 'until curl -s http://localhost:3000/api/health; do sleep 1; done'

- name: Run E2E tests
  run: |
    cd test-reporter/dashboard
    pnpm install
    DASHBOARD_URL=http://localhost:5173 API_URL=http://localhost:3000 pnpm test:e2e
```

## Test Data

Tests seed their own data via the API before running. The seed script (`seed.ts`) creates:

- 3 test runs with varying results
- 4 additional runs for flaky test detection
- Mix of passed, failed, and skipped tests

This ensures tests are deterministic and don't depend on existing data.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DASHBOARD_URL` | Dashboard URL | http://localhost:5173 |
| `API_URL` | Backend API URL | http://localhost:3000 |
