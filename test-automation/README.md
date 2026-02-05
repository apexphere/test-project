# Test Automation

Playwright E2E test suite for the e-commerce SUT.

## Prerequisites

Before running tests, ensure the full stack is running:

1. **Frontend** on `http://localhost:5173` (Vite)
2. **Backend API** on `http://localhost:8000` (FastAPI)
3. **Auth Service** on `http://localhost:8001` (FastAPI)

### Using Docker Compose (recommended)

```bash
cd sut
docker-compose up -d
```

### Manual start

If running services individually, ensure all three are healthy before running tests.

## Environment Variables

| Variable           | Default                   | Description                |
| ------------------ | ------------------------- | -------------------------- |
| `BASE_URL`         | `http://localhost:5173`   | Frontend URL               |
| `BACKEND_URL`      | `http://localhost:8000`   | Backend API URL            |
| `AUTH_SERVICE_URL` | `http://localhost:8001`   | Auth Service URL           |

## Test Data Setup

The test suite includes a **global setup** (`global-setup.ts`) that:

1. Waits for the Auth Service to be healthy
2. Seeds test users via the `/auth/register` endpoint

This ensures tests have the required data regardless of how services were started.

Seeded users:

| User  | Email               | Password   |
| ----- | ------------------- | ---------- |
| admin | admin@example.com   | admin123   |
| user  | user@example.com    | user123    |

## Running Tests

```bash
# Install dependencies
npm ci

# Run all tests
npm test

# Run in headed mode (visible browser)
npm run test:headed

# Run with Playwright UI
npm run test:ui

# Debug mode
npm run test:debug

# View HTML report
npm run report
```

## Test Structure

```
test-automation/
├── tests/
│   ├── auth/
│   │   ├── login.spec.ts                 # Login flow tests
│   │   ├── register.spec.ts              # Registration flow tests
│   │   └── auth-service-integration.spec.ts  # Auth Service integration tests
│   └── products/
│       └── products.spec.ts              # Product catalog tests
├── pages/                                # Page Object Model
│   ├── base.page.ts
│   ├── login.page.ts
│   ├── register.page.ts
│   └── products.page.ts
├── utils/
│   └── test-data.ts                      # Test data & helpers
├── global-setup.ts                       # Seeds test users before tests
└── playwright.config.ts                  # Playwright configuration
```

## Architecture Notes

The SUT uses a **microservices architecture**:

- **Frontend**: React app that talks to two backend services
- **Backend API** (`/api/*`): Products, cart, orders — uses `VITE_API_URL`
- **Auth Service** (`/auth/*`): Login, register, user profile — uses `VITE_AUTH_URL`

The E2E tests interact with the **browser UI**, not the APIs directly. The frontend
handles routing requests to the correct service, so tests don't need to know which
service handles which endpoint — they just drive the browser.

## CI/CD

In CI, set the environment variables to match your CI environment's service URLs
and ensure all services are healthy before running tests. The global setup will
wait up to 30 seconds for the Auth Service health check.
