# Test Reporter

A service for collecting, storing, and analyzing Playwright test results.

## Overview

The Test Reporter service provides:
- **Ingestion API**: Accept test results from Playwright runs
- **Query API**: Retrieve historical test data
- **Analytics**: Track flakiness, pass rates, and duration trends
- **Dashboard UI**: Visualize test health, flaky tests, and trends
- **Persistence**: Store data in PostgreSQL for long-term analysis

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 20+ (for local development)
- pnpm

### Running with Docker Compose

```bash
# Start PostgreSQL + server
docker-compose up -d

# View logs
docker-compose logs -f server

# Stop
docker-compose down
```

The API will be available at `http://localhost:3000`

### Development Mode

```bash
# Start server + dashboard with hot reload
docker-compose --profile dev up -d postgres server-dev dashboard-dev

# Or run locally
cd server
pnpm install
pnpm run db:migrate
pnpm run dev

# In another terminal, run the dashboard
cd dashboard
pnpm install
pnpm run dev
```

- API: `http://localhost:3000`
- Dashboard: `http://localhost:5173`

## API Endpoints

### Submit Test Run

```bash
POST /api/runs

curl -X POST http://localhost:3000/api/runs \
  -H "Content-Type: application/json" \
  -d '{
    "source": "local",
    "branch": "develop",
    "startedAt": "2026-02-07T10:00:00Z",
    "completedAt": "2026-02-07T10:02:30Z",
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
```

### List Runs

```bash
GET /api/runs?limit=20&offset=0&branch=develop&status=failed

curl http://localhost:3000/api/runs
```

### Get Run Details

```bash
GET /api/runs/:runId

curl http://localhost:3000/api/runs/550e8400-e29b-41d4-a716-446655440000
```

### Health Check

```bash
GET /api/health

curl http://localhost:3000/api/health
```

## Data Model

### Tables

- **runs**: Test run metadata (branch, commit, timing, summary stats)
- **test_results**: Individual test outcomes per run
- **test_stats**: Aggregated statistics per test (pass rate, flakiness, duration)

### Flakiness Score

Tests are scored from 0.0 (stable) to 1.0 (highly flaky) based on result transitions:

```
[P,P,P,P,P] = 0.0  (stable pass)
[F,F,F,F,F] = 0.0  (stable fail)
[P,F,P,F,P] = 1.0  (maximum flakiness)
[P,P,P,F,P] = 0.5  (moderately flaky)
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | (required) |
| `PORT` | HTTP server port | 3000 |
| `NODE_ENV` | Environment | development |
| `LOG_LEVEL` | Logging level | info |
| `RETENTION_DAYS` | Data retention period | 90 |
| `MAX_PAYLOAD_SIZE` | Max request body size | 10mb |

## Project Structure

```
test-reporter/
├── server/                   # Backend API
│   ├── src/
│   │   ├── index.ts          # Entry point
│   │   ├── config.ts         # Configuration
│   │   ├── schemas.ts        # Zod validation schemas
│   │   ├── routes/
│   │   │   ├── index.ts      # Route aggregator
│   │   │   ├── runs.ts       # /api/runs endpoints
│   │   │   ├── tests.ts      # /api/tests endpoints
│   │   │   └── insights.ts   # /api/insights endpoints
│   │   ├── db/
│   │   │   ├── index.ts      # Database connection
│   │   │   ├── schema.ts     # Drizzle ORM schema
│   │   │   ├── migrate.ts    # Migration runner
│   │   │   └── migrations/   # SQL migrations
│   │   └── services/
│   │       └── ingestion.ts  # Run ingestion logic
│   ├── tests/                # Unit/integration tests
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   └── drizzle.config.ts
├── dashboard/                # React frontend
│   ├── src/
│   │   ├── App.tsx           # Root component with routing
│   │   ├── components/       # Reusable UI components
│   │   │   ├── Card.tsx      # Stat cards, containers
│   │   │   ├── Table.tsx     # Data tables
│   │   │   ├── Badge.tsx     # Status badges
│   │   │   └── Chart.tsx     # Line charts (pass rate, duration)
│   │   ├── pages/            # Page components
│   │   │   ├── Dashboard.tsx # Overview with stats, charts, lists
│   │   │   ├── RunDetail.tsx # Single run with all test results
│   │   │   └── TestDetail.tsx # Test history and trends
│   │   └── lib/
│   │       └── api.ts        # API client
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── Dockerfile
│   └── nginx.conf
├── docker-compose.yml
└── README.md
```

## Testing

```bash
cd server

# Run tests
pnpm test

# Run tests with watch mode
pnpm test:watch

# Type check
pnpm typecheck
```

## Dashboard

The dashboard provides a visual interface for test analytics:

- **Overview**: Total runs, pass rate, test count, and trend indicator
- **Pass Rate Chart**: Line chart showing pass rate over recent runs
- **Flaky Tests**: Top 5 tests ranked by flakiness score
- **Slow Tests**: Top 5 tests ranked by average duration
- **Recent Runs**: Table of recent test runs with status
- **Run Detail**: Click any run to see all test results
- **Test Detail**: Click any test to see historical results and trends

### Tech Stack

- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- Recharts (charts)
- React Router (navigation)

## Deployment

The test-reporter service is containerized and ready for deployment. Below are instructions for two recommended platforms.

### Option 1: Fly.io (Recommended)

Fly.io provides a simple deployment experience with a generous free tier.

#### Prerequisites
- Install the [Fly CLI](https://fly.io/docs/flyctl/install/)
- Create a Fly.io account: `fly auth signup`

#### Deploy

```bash
cd test-reporter

# Create a new Fly app (first time only)
fly launch --no-deploy

# Create a PostgreSQL database
fly postgres create --name test-reporter-db

# Attach database to app (sets DATABASE_URL secret automatically)
fly postgres attach test-reporter-db

# Deploy the application
fly deploy

# Check the deployment
fly status
fly logs
```

#### Environment Variables

Set any additional secrets:
```bash
fly secrets set LOG_LEVEL=info
fly secrets set RETENTION_DAYS=90
```

#### Access

Your app will be available at `https://test-reporter.fly.dev` (or your custom domain).

### Option 2: Railway

Railway offers a developer-friendly platform with automatic deployments from Git.

#### Prerequisites
- Create a [Railway account](https://railway.app/)
- Install the [Railway CLI](https://docs.railway.app/develop/cli) (optional)

#### Deploy via Dashboard

1. Go to [Railway Dashboard](https://railway.app/dashboard)
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your repository and the `test-reporter/server` directory
4. Railway will auto-detect the Dockerfile
5. Add a PostgreSQL database:
   - Click **New** → **Database** → **PostgreSQL**
   - Railway automatically sets `DATABASE_URL`
6. Add environment variables in the **Variables** tab:
   - `NODE_ENV=production`
   - `PORT=3000`

#### Deploy via CLI

```bash
cd test-reporter/server

# Login to Railway
railway login

# Initialize project
railway init

# Add PostgreSQL
railway add --database postgres

# Deploy
railway up

# Get the deployment URL
railway open
```

#### Custom Domain

In the Railway dashboard, go to **Settings** → **Domains** to add a custom domain.

### CI Integration

Once deployed, add the `TEST_REPORTER_URL` secret to your GitHub repository:

1. Go to your repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `TEST_REPORTER_URL`
4. Value: Your deployment URL (e.g., `https://test-reporter.fly.dev` or `https://your-app.railway.app`)

The CI workflow is already configured to pass this URL to Playwright tests. The custom reporter will automatically send test results to your deployed service.

### Fail-Open Behavior

The custom reporter (`test-automation/reporters/test-reporter.ts`) is designed with fail-open behavior:

- **5-second timeout**: If the test-reporter service doesn't respond within 5 seconds, the reporter gives up
- **No test failures**: Connection errors, timeouts, or service outages will NOT cause your tests to fail
- **Graceful logging**: Issues are logged as warnings, not errors

This ensures your CI pipeline remains reliable even if the reporting service is temporarily unavailable.

### Health Check

The service exposes a health endpoint for monitoring:

```bash
curl https://your-deployment-url.com/api/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2026-02-07T12:00:00.000Z",
  "database": "connected",
  "responseTimeMs": 5
}
```

Returns HTTP 200 when healthy, HTTP 503 when database is disconnected (useful for load balancer health checks).

### Docker Build

The server Dockerfile (`server/Dockerfile`) is production-ready:

```bash
# Build the image
docker build -t test-reporter:latest ./server

# Run locally (requires DATABASE_URL)
docker run -p 3000:3000 \
  -e DATABASE_URL=postgres://user:pass@host:5432/db \
  test-reporter:latest
```

The Dockerfile:
- Multi-stage build for smaller image size
- Runs as non-root (security best practice)
- Includes healthcheck for container orchestration
- Production dependencies only
