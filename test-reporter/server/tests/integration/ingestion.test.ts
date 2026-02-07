/**
 * Integration tests for Ingestion API (POST /api/runs)
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  setupTestDb,
  teardownTestDb,
  cleanTestData,
  createTestApp,
  getTestDb,
} from './setup.js';
import { testStats } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';

describe('Ingestion API - POST /api/runs', () => {
  let app: Express;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await cleanTestData();
  });

  describe('Valid payloads', () => {
    it('should store a valid test run correctly', async () => {
      const payload = {
        source: 'ci',
        branch: 'develop',
        commitSha: 'a'.repeat(40),
        startedAt: '2026-02-07T10:00:00Z',
        completedAt: '2026-02-07T10:05:00Z',
        results: [
          {
            testId: 'auth/login.spec.ts:should login successfully',
            title: 'should login successfully',
            file: 'auth/login.spec.ts',
            status: 'passed',
            duration: 2345,
            retries: 0,
          },
          {
            testId: 'auth/login.spec.ts:should show error',
            title: 'should show error',
            file: 'auth/login.spec.ts',
            status: 'failed',
            duration: 1234,
            retries: 1,
            error: {
              message: 'Expected element to be visible',
              stack: 'Error at test.ts:10',
            },
          },
        ],
      };

      const response = await request(app)
        .post('/api/runs')
        .send(payload)
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body).toMatchObject({
        runId: expect.any(String),
        testsReceived: 2,
        testsStored: 2,
      });

      // Verify UUID format
      expect(response.body.runId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should accept local source', async () => {
      const payload = {
        source: 'local',
        startedAt: '2026-02-07T10:00:00Z',
        completedAt: '2026-02-07T10:01:00Z',
        results: [
          {
            testId: 'test.spec.ts:test',
            title: 'test',
            file: 'test.spec.ts',
            status: 'passed',
            duration: 100,
            retries: 0,
          },
        ],
      };

      const response = await request(app)
        .post('/api/runs')
        .send(payload)
        .expect(201);

      expect(response.body.testsReceived).toBe(1);
    });

    it('should accept skipped and timedOut statuses', async () => {
      const payload = {
        source: 'ci',
        startedAt: '2026-02-07T10:00:00Z',
        completedAt: '2026-02-07T10:01:00Z',
        results: [
          {
            testId: 'test1.spec.ts:skipped test',
            title: 'skipped test',
            file: 'test1.spec.ts',
            status: 'skipped',
            duration: 0,
            retries: 0,
          },
          {
            testId: 'test2.spec.ts:timedOut test',
            title: 'timedOut test',
            file: 'test2.spec.ts',
            status: 'timedOut',
            duration: 30000,
            retries: 0,
          },
        ],
      };

      const response = await request(app)
        .post('/api/runs')
        .send(payload)
        .expect(201);

      expect(response.body.testsReceived).toBe(2);
    });

    it('should accept optional prNumber field', async () => {
      const payload = {
        source: 'ci',
        branch: 'feature/test',
        prNumber: 42,
        startedAt: '2026-02-07T10:00:00Z',
        completedAt: '2026-02-07T10:01:00Z',
        results: [
          {
            testId: 'test.spec.ts:test',
            title: 'test',
            file: 'test.spec.ts',
            status: 'passed',
            duration: 100,
            retries: 0,
          },
        ],
      };

      const response = await request(app)
        .post('/api/runs')
        .send(payload)
        .expect(201);

      expect(response.body.runId).toBeDefined();
    });
  });

  describe('Invalid payloads - should return 400', () => {
    it('should reject invalid source', async () => {
      const payload = {
        source: 'invalid',
        startedAt: '2026-02-07T10:00:00Z',
        completedAt: '2026-02-07T10:01:00Z',
        results: [
          {
            testId: 'test.spec.ts:test',
            title: 'test',
            file: 'test.spec.ts',
            status: 'passed',
            duration: 100,
            retries: 0,
          },
        ],
      };

      const response = await request(app)
        .post('/api/runs')
        .send(payload)
        .expect(400);

      expect(response.body.error).toBe('Invalid payload');
    });

    it('should reject empty results array', async () => {
      const payload = {
        source: 'ci',
        startedAt: '2026-02-07T10:00:00Z',
        completedAt: '2026-02-07T10:01:00Z',
        results: [],
      };

      const response = await request(app)
        .post('/api/runs')
        .send(payload)
        .expect(400);

      expect(response.body.error).toBe('Invalid payload');
    });

    it('should reject invalid test status', async () => {
      const payload = {
        source: 'ci',
        startedAt: '2026-02-07T10:00:00Z',
        completedAt: '2026-02-07T10:01:00Z',
        results: [
          {
            testId: 'test.spec.ts:test',
            title: 'test',
            file: 'test.spec.ts',
            status: 'unknown',
            duration: 100,
            retries: 0,
          },
        ],
      };

      const response = await request(app)
        .post('/api/runs')
        .send(payload)
        .expect(400);

      expect(response.body.error).toBe('Invalid payload');
    });

    it('should reject missing required fields', async () => {
      const payload = {
        source: 'ci',
        // missing startedAt, completedAt, results
      };

      const response = await request(app)
        .post('/api/runs')
        .send(payload)
        .expect(400);

      expect(response.body.error).toBe('Invalid payload');
    });

    it('should reject invalid datetime format', async () => {
      const payload = {
        source: 'ci',
        startedAt: 'not-a-date',
        completedAt: '2026-02-07T10:01:00Z',
        results: [
          {
            testId: 'test.spec.ts:test',
            title: 'test',
            file: 'test.spec.ts',
            status: 'passed',
            duration: 100,
            retries: 0,
          },
        ],
      };

      const response = await request(app)
        .post('/api/runs')
        .send(payload)
        .expect(400);

      expect(response.body.error).toBe('Invalid payload');
    });
  });

  describe('test_stats table updates', () => {
    it('should create test_stats for new tests after ingestion', async () => {
      const db = getTestDb();
      const payload = {
        source: 'ci',
        startedAt: '2026-02-07T10:00:00Z',
        completedAt: '2026-02-07T10:01:00Z',
        results: [
          {
            testId: 'new-test.spec.ts:brand new test',
            title: 'brand new test',
            file: 'new-test.spec.ts',
            status: 'passed',
            duration: 500,
            retries: 0,
          },
        ],
      };

      await request(app)
        .post('/api/runs')
        .send(payload)
        .expect(201);

      // Verify test_stats was created
      const [stats] = await db
        .select()
        .from(testStats)
        .where(eq(testStats.testId, 'new-test.spec.ts:brand new test'));

      expect(stats).toBeDefined();
      expect(stats.totalRuns).toBe(1);
      expect(stats.totalPassed).toBe(1);
      expect(stats.totalFailed).toBe(0);
      expect(stats.avgDurationMs).toBe(500);
      expect(stats.lastStatus).toBe('passed');
    });

    it('should update existing test_stats after subsequent ingestions', async () => {
      const db = getTestDb();
      const testId = 'stats-test.spec.ts:updates correctly';

      // First run - passed
      await request(app)
        .post('/api/runs')
        .send({
          source: 'ci',
          startedAt: '2026-02-07T10:00:00Z',
          completedAt: '2026-02-07T10:01:00Z',
          results: [
            {
              testId,
              title: 'updates correctly',
              file: 'stats-test.spec.ts',
              status: 'passed',
              duration: 1000,
              retries: 0,
            },
          ],
        })
        .expect(201);

      // Second run - failed
      await request(app)
        .post('/api/runs')
        .send({
          source: 'ci',
          startedAt: '2026-02-07T11:00:00Z',
          completedAt: '2026-02-07T11:01:00Z',
          results: [
            {
              testId,
              title: 'updates correctly',
              file: 'stats-test.spec.ts',
              status: 'failed',
              duration: 2000,
              retries: 1,
              error: { message: 'Test failed' },
            },
          ],
        })
        .expect(201);

      // Verify stats were updated
      const [stats] = await db
        .select()
        .from(testStats)
        .where(eq(testStats.testId, testId));

      expect(stats.totalRuns).toBe(2);
      expect(stats.totalPassed).toBe(1);
      expect(stats.totalFailed).toBe(1);
      expect(stats.avgDurationMs).toBe(1500); // (1000 + 2000) / 2
      expect(stats.minDurationMs).toBe(1000);
      expect(stats.maxDurationMs).toBe(2000);
      expect(stats.lastStatus).toBe('failed');
    });
  });
});
