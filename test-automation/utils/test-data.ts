import { SignupData } from '../pages';

/**
 * Generate unique email to avoid "Email already exists" errors
 */
export function generateUniqueEmail(prefix: string = 'testuser'): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return `${prefix}_${timestamp}_${random}@test.com`;
}

/**
 * Generate complete signup data with defaults
 */
export function generateSignupData(overrides: Partial<SignupData> = {}): SignupData {
  const timestamp = Date.now();
  return {
    name: `Test User ${timestamp}`,
    email: generateUniqueEmail(),
    password: 'Test@1234',
    title: 'Mr',
    birthDay: '15',
    birthMonth: '6',
    birthYear: '1990',
    firstName: 'Test',
    lastName: 'User',
    company: 'Test Company',
    address: '123 Test Street',
    address2: 'Apt 456',
    country: 'United States',
    state: 'California',
    city: 'Los Angeles',
    zipcode: '90001',
    mobileNumber: '1234567890',
    newsletter: true,
    specialOffers: true,
    ...overrides,
  };
}
