import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    // Integration tests need more time (real DB calls)
    testTimeout: 30000,
    hookTimeout: 30000,
    // Run tests sequentially to avoid DB conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
