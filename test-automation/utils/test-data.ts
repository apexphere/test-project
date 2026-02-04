import type { RegisterData } from '../pages';

/**
 * Test users seeded in the database
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
 * Generate unique registration data for a new user
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
 * Invalid test data for negative testing
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
