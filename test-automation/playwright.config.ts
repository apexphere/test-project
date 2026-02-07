import { defineConfig, devices } from '@playwright/test';

/**
 * Environment variables:
 *   BASE_URL            — Frontend URL           (default: http://localhost:5173)
 *   AUTH_SERVICE_URL    — Auth Service URL        (default: http://localhost:8001)
 *   BACKEND_URL         — Backend API URL         (default: http://localhost:8000)
 *   TEST_REPORTER_URL   — Test Reporter service  (optional, enables result collection)
 *
 * The Auth Service must be running before tests start. The global-setup
 * script waits for its /health endpoint and seeds test users via the
 * /auth/register API.
 */

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html'],
    ['list'],
    ['./reporters/test-reporter.ts'],
  ],

  /* Seed test users in the Auth Service before any test runs */
  globalSetup: require.resolve('./global-setup'),

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /**
   * Start the full stack before running tests (CI or local convenience).
   *
   * The recommended way is to run the services via docker-compose:
   *   cd sut && docker-compose up -d
   *
   * If you'd rather have Playwright manage the processes, uncomment the
   * webServer array below.  The entries start:
   *   1. Auth Service  (port 8001)
   *   2. Backend API   (port 8000)
   *   3. Frontend dev  (port 5173)
   */
  // webServer: [
  //   {
  //     command: 'cd ../sut/auth-service && uvicorn app.main:app --host 0.0.0.0 --port 8001',
  //     url: 'http://localhost:8001/health',
  //     reuseExistingServer: !process.env.CI,
  //     timeout: 30_000,
  //   },
  //   {
  //     command: 'cd ../sut/backend && uvicorn app.main:app --host 0.0.0.0 --port 8000',
  //     url: 'http://localhost:8000/health',
  //     reuseExistingServer: !process.env.CI,
  //     timeout: 30_000,
  //   },
  //   {
  //     command: 'cd ../sut/frontend && npm run dev',
  //     url: 'http://localhost:5173',
  //     reuseExistingServer: !process.env.CI,
  //     timeout: 30_000,
  //   },
  // ],
});
