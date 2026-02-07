import '@testing-library/jest-dom';
import { vi, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';

// Check if we're running integration tests (MSW enabled)
const isIntegrationTest = process.env.INTEGRATION_TESTS === 'true';

// Setup MSW for integration tests
if (isIntegrationTest) {
  const { server } = await import('../../tests/mocks/server');
  beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
}

// Real localStorage mock for integration tests
const createLocalStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
};

const localStorageMock = createLocalStorageMock();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
});
