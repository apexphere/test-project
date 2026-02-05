import type { RegisterData } from '../pages';

/**
 * Service URLs — used by helpers that call service APIs directly.
 *
 * Tests themselves interact with the browser and don't need these;
 * they're mainly consumed by global-setup and any API-level utilities.
 */
export const SERVICE_URLS = {
  frontend: process.env.BASE_URL || 'http://localhost:5173',
  backend: process.env.BACKEND_URL || 'http://localhost:8000',
  authService: process.env.AUTH_SERVICE_URL || 'http://localhost:8001',
} as const;

/**
 * Test users seeded in the Auth Service database.
 *
 * These are created by `global-setup.ts` via the Auth Service /auth/register
 * endpoint before any test runs. They mirror the Auth Service's own seed data
 * so the tests work whether the service was freshly started or already seeded.
 */
export const TEST_USERS = {
  admin: {
    email: 'admin@example.com',
    password: 'admin123',
    fullName: 'Admin User',
  },
  user: {
    email: 'user@example.com',
    password: 'user123',
    fullName: 'Test User',
  },
} as const;

/**
 * Generate unique registration data for a new user.
 */
export function generateUniqueUser(): RegisterData {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);

  return {
    fullName: `Test User ${random}`,
    email: `test.${timestamp}.${random}@example.com`,
    password: 'TestPass123!',
  };
}

/**
 * Invalid test data for negative testing.
 */
export const INVALID_DATA = {
  emptyEmail: '',
  invalidEmail: 'not-an-email',
  emptyPassword: '',
  shortPassword: '123',
  nonExistentUser: {
    email: 'doesnotexist@example.com',
    password: 'wrongpassword',
  },
} as const;
