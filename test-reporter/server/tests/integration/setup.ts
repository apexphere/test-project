/**
 * Integration test setup for test-reporter API.
 * Manages PostgreSQL test database lifecycle.
 */

import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as schema from '../../src/db/schema.js';
import { sql } from 'drizzle-orm';
import express, { type Express } from 'express';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test database connection string (docker-compose.test.yml uses port 5434)
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 
  'postgres://reporter:reporter@localhost:5434/test_reporter_test';

let pool: Pool | null = null;
let testDb: NodePgDatabase<typeof schema> | null = null;

/**
 * Initialize the test database connection and run migrations.
 */
export async function setupTestDb(): Promise<NodePgDatabase<typeof schema>> {
  if (testDb) return testDb;

  pool = new Pool({
    connectionString: TEST_DATABASE_URL,
    max: 5,
  });

  testDb = drizzle(pool, { schema });

  // Run migrations to ensure schema is up to date
  const migrationsPath = path.resolve(__dirname, '../../src/db/migrations');
  await migrate(testDb, { migrationsFolder: migrationsPath });

  return testDb;
}

/**
 * Clean all test data from tables (preserves schema).
 */
export async function cleanTestData(): Promise<void> {
  if (!testDb) throw new Error('Test database not initialized');

  // Delete in correct order due to foreign keys
  await testDb.delete(schema.testResults);
  await testDb.delete(schema.testStats);
  await testDb.delete(schema.runs);
}

/**
 * Close the test database connection.
 */
export async function teardownTestDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    testDb = null;
  }
}

/**
 * Get the test database instance.
 */
export function getTestDb(): NodePgDatabase<typeof schema> {
  if (!testDb) throw new Error('Test database not initialized');
  return testDb;
}

/**
 * Create a test Express app with real database.
 * This bypasses the normal module imports to inject test DB.
 */
export async function createTestApp(): Promise<Express> {
  const db = await setupTestDb();
  
  // Dynamically create routes with test database
  const app = express();
  app.use(helmet());
  app.use(express.json({ limit: '10mb' }));

  // We need to create routes that use our test db
  const { createRoutes } = await import('./route-factory.js');
  const routes = createRoutes(db);
  
  app.use('/api', routes);

  return app;
}

/**
 * Seed test data for integration tests.
 */
export async function seedTestData() {
  const db = getTestDb();

  // Create test runs
  const [run1] = await db.insert(schema.runs).values({
    source: 'ci',
    branch: 'develop',
    commitSha: 'a'.repeat(40),
    prNumber: null,
    startedAt: new Date('2026-02-07T10:00:00Z'),
    completedAt: new Date('2026-02-07T10:05:00Z'),
    totalTests: 3,
    passed: 2,
    failed: 1,
    skipped: 0,
    durationMs: 300000,
  }).returning();

  const [run2] = await db.insert(schema.runs).values({
    source: 'local',
    branch: 'feature/test',
    commitSha: 'b'.repeat(40),
    prNumber: 42,
    startedAt: new Date('2026-02-07T11:00:00Z'),
    completedAt: new Date('2026-02-07T11:03:00Z'),
    totalTests: 2,
    passed: 2,
    failed: 0,
    skipped: 0,
    durationMs: 180000,
  }).returning();

  // Create test results for run1
  await db.insert(schema.testResults).values([
    {
      runId: run1.id,
      testId: 'auth/login.spec.ts:should login successfully',
      title: 'should login successfully',
      file: 'auth/login.spec.ts',
      status: 'passed',
      durationMs: 2345,
      retries: 0,
    },
    {
      runId: run1.id,
      testId: 'auth/login.spec.ts:should show error',
      title: 'should show error',
      file: 'auth/login.spec.ts',
      status: 'failed',
      durationMs: 1234,
      retries: 1,
      errorMessage: 'Expected element to be visible',
      errorStack: 'Error: Expected element to be visible\n    at test.spec.ts:10:5',
    },
    {
      runId: run1.id,
      testId: 'cart/add.spec.ts:should add item',
      title: 'should add item',
      file: 'cart/add.spec.ts',
      status: 'passed',
      durationMs: 3456,
      retries: 0,
    },
  ]);

  // Create test results for run2
  await db.insert(schema.testResults).values([
    {
      runId: run2.id,
      testId: 'auth/login.spec.ts:should login successfully',
      title: 'should login successfully',
      file: 'auth/login.spec.ts',
      status: 'passed',
      durationMs: 2100,
      retries: 0,
    },
    {
      runId: run2.id,
      testId: 'auth/login.spec.ts:should show error',
      title: 'should show error',
      file: 'auth/login.spec.ts',
      status: 'passed', // Passed this time (was flaky)
      durationMs: 1500,
      retries: 0,
    },
  ]);

  // Create test stats
  await db.insert(schema.testStats).values([
    {
      testId: 'auth/login.spec.ts:should login successfully',
      title: 'should login successfully',
      file: 'auth/login.spec.ts',
      totalRuns: 10,
      totalPassed: 10,
      totalFailed: 0,
      totalSkipped: 0,
      avgDurationMs: 2200,
      minDurationMs: 1800,
      maxDurationMs: 2600,
      flakinessScore: 0.0,
      lastRunAt: new Date('2026-02-07T11:03:00Z'),
      lastStatus: 'passed',
    },
    {
      testId: 'auth/login.spec.ts:should show error',
      title: 'should show error',
      file: 'auth/login.spec.ts',
      totalRuns: 10,
      totalPassed: 7,
      totalFailed: 3,
      totalSkipped: 0,
      avgDurationMs: 1350,
      minDurationMs: 1000,
      maxDurationMs: 1800,
      flakinessScore: 0.6, // Flaky test
      lastRunAt: new Date('2026-02-07T11:03:00Z'),
      lastStatus: 'passed',
    },
    {
      testId: 'cart/add.spec.ts:should add item',
      title: 'should add item',
      file: 'cart/add.spec.ts',
      totalRuns: 5,
      totalPassed: 5,
      totalFailed: 0,
      totalSkipped: 0,
      avgDurationMs: 3456,
      minDurationMs: 3000,
      maxDurationMs: 4000,
      flakinessScore: 0.0,
      lastRunAt: new Date('2026-02-07T10:05:00Z'),
      lastStatus: 'passed',
    },
    {
      testId: 'checkout/payment.spec.ts:slow test',
      title: 'slow test',
      file: 'checkout/payment.spec.ts',
      totalRuns: 8,
      totalPassed: 8,
      totalFailed: 0,
      totalSkipped: 0,
      avgDurationMs: 15000, // Very slow
      minDurationMs: 12000,
      maxDurationMs: 18000,
      flakinessScore: 0.0,
      lastRunAt: new Date('2026-02-07T09:00:00Z'),
      lastStatus: 'passed',
    },
  ]);

  return { run1, run2 };
}

export { schema };
