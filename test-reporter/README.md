# Test Reporter

A service for collecting, storing, and analyzing Playwright test results.

## Overview

The Test Reporter service provides:
- **Ingestion API**: Accept test results from Playwright runs
- **Query API**: Retrieve historical test data
- **Analytics**: Track flakiness, pass rates, and duration trends
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
# Start with hot reload
docker-compose --profile dev up -d postgres server-dev

# Or run locally
cd server
pnpm install
pnpm run db:migrate
pnpm run dev
```

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
├── server/
│   ├── src/
│   │   ├── index.ts          # Entry point
│   │   ├── config.ts         # Configuration
│   │   ├── schemas.ts        # Zod validation schemas
│   │   ├── routes/
│   │   │   ├── index.ts      # Route aggregator
│   │   │   └── runs.ts       # /api/runs endpoints
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

## Future Phases

- **Phase 2**: Playwright custom reporter integration
- **Phase 3**: Query API & insights endpoints (/api/insights/flaky, /api/insights/slow)
- **Phase 4**: Dashboard UI (React + Vite + Tailwind)
- **Phase 5**: CI/CD integration
