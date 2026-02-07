/**
 * Integration tests for Query API
 * - GET /api/runs
 * - GET /api/runs/:id
 * - GET /api/tests
 * - GET /api/tests/:id/history
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  setupTestDb,
  teardownTestDb,
  cleanTestData,
  createTestApp,
  seedTestData,
} from './setup.js';

describe('Query API', () => {
  let app: Express;
  let seededData: Awaited<ReturnType<typeof seedTestData>>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await cleanTestData();
    seededData = await seedTestData();
  });

  describe('GET /api/runs', () => {
    it('should return list of runs with pagination', async () => {
      const response = await request(app)
        .get('/api/runs')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('runs');
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('hasMore');
      expect(Array.isArray(response.body.runs)).toBe(true);
      expect(response.body.total).toBe(2); // Two seeded runs
    });

    it('should respect limit and offset parameters', async () => {
      const response = await request(app)
        .get('/api/runs?limit=1&offset=0')
        .expect(200);

      expect(response.body.runs).toHaveLength(1);
      expect(response.body.hasMore).toBe(true);
    });

    it('should filter by branch', async () => {
      const response = await request(app)
        .get('/api/runs?branch=develop')
        .expect(200);

      expect(response.body.runs).toHaveLength(1);
      expect(response.body.runs[0].branch).toBe('develop');
    });

    it('should filter by status=passed (no failures)', async () => {
      const response = await request(app)
        .get('/api/runs?status=passed')
        .expect(200);

      expect(response.body.runs).toHaveLength(1);
      expect(response.body.runs[0].failed).toBe(0);
    });

    it('should filter by status=failed (has failures)', async () => {
      const response = await request(app)
        .get('/api/runs?status=failed')
        .expect(200);

      expect(response.body.runs).toHaveLength(1);
      expect(response.body.runs[0].failed).toBeGreaterThan(0);
    });

    it('should order by createdAt descending', async () => {
      const response = await request(app)
        .get('/api/runs')
        .expect(200);

      const dates = response.body.runs.map((r: any) => new Date(r.createdAt).getTime());
      expect(dates).toEqual([...dates].sort((a, b) => b - a));
    });
  });

  describe('GET /api/runs/:id', () => {
    it('should return run with results', async () => {
      const runId = seededData.run1.id;

      const response = await request(app)
        .get(`/api/runs/${runId}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('run');
      expect(response.body).toHaveProperty('results');
      expect(response.body).toHaveProperty('summary');

      expect(response.body.run.id).toBe(runId);
      expect(response.body.results).toHaveLength(3); // 3 test results for run1
      expect(response.body.summary).toMatchObject({
        total: 3,
        passed: 2,
        failed: 1,
        skipped: 0,
      });
    });

    it('should return 404 for non-existent run', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app)
        .get(`/api/runs/${fakeId}`)
        .expect(404);

      expect(response.body.error).toBe('Run not found');
    });

    it('should return 400 for invalid UUID format', async () => {
      const response = await request(app)
        .get('/api/runs/not-a-uuid')
        .expect(400);

      expect(response.body.error).toBe('Invalid run ID format');
    });

    it('should include test result details', async () => {
      const runId = seededData.run1.id;

      const response = await request(app)
        .get(`/api/runs/${runId}`)
        .expect(200);

      const failedResult = response.body.results.find(
        (r: any) => r.status === 'failed'
      );

      expect(failedResult).toBeDefined();
      expect(failedResult.errorMessage).toBe('Expected element to be visible');
      expect(failedResult.retries).toBe(1);
    });
  });

  describe('GET /api/tests', () => {
    it('should return tests with aggregated stats', async () => {
      const response = await request(app)
        .get('/api/tests')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('tests');
      expect(Array.isArray(response.body.tests)).toBe(true);
      expect(response.body.tests.length).toBeGreaterThan(0);

      const test = response.body.tests[0];
      expect(test).toHaveProperty('testId');
      expect(test).toHaveProperty('title');
      expect(test).toHaveProperty('file');
      expect(test).toHaveProperty('totalRuns');
      expect(test).toHaveProperty('totalPassed');
      expect(test).toHaveProperty('totalFailed');
      expect(test).toHaveProperty('avgDurationMs');
      expect(test).toHaveProperty('passRate');
      expect(test).toHaveProperty('failRate');
    });

    it('should order by flakiness when requested', async () => {
      const response = await request(app)
        .get('/api/tests?orderBy=flakiness&order=desc')
        .expect(200);

      const scores = response.body.tests.map((t: any) => t.flakinessScore);
      expect(scores).toEqual([...scores].sort((a, b) => b - a));
    });

    it('should order by avgDuration when requested', async () => {
      const response = await request(app)
        .get('/api/tests?orderBy=avgDuration&order=desc')
        .expect(200);

      const durations = response.body.tests.map((t: any) => t.avgDurationMs);
      expect(durations).toEqual([...durations].sort((a, b) => b - a));
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/tests?limit=2')
        .expect(200);

      expect(response.body.tests.length).toBeLessThanOrEqual(2);
    });

    it('should calculate passRate and failRate correctly', async () => {
      const response = await request(app)
        .get('/api/tests')
        .expect(200);

      // Find the flaky test (7 passed, 3 failed out of 10)
      const flakyTest = response.body.tests.find(
        (t: any) => t.testId === 'auth/login.spec.ts:should show error'
      );

      expect(flakyTest).toBeDefined();
      expect(flakyTest.passRate).toBeCloseTo(70, 0); // 70%
      expect(flakyTest.failRate).toBeCloseTo(30, 0); // 30%
    });
  });

  describe('GET /api/tests/:id/history', () => {
    it('should return test history', async () => {
      const testId = encodeURIComponent('auth/login.spec.ts:should login successfully');

      const response = await request(app)
        .get(`/api/tests/${testId}/history`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('test');
      expect(response.body).toHaveProperty('history');
      expect(Array.isArray(response.body.history)).toBe(true);

      // Should have 2 history entries (one per seeded run)
      expect(response.body.history.length).toBe(2);
    });

    it('should return 404 for non-existent test', async () => {
      const testId = encodeURIComponent('nonexistent.spec.ts:does not exist');

      const response = await request(app)
        .get(`/api/tests/${testId}/history`)
        .expect(404);

      expect(response.body.error).toBe('Test not found');
    });

    it('should include test stats in response', async () => {
      const testId = encodeURIComponent('auth/login.spec.ts:should show error');

      const response = await request(app)
        .get(`/api/tests/${testId}/history`)
        .expect(200);

      expect(response.body.test).toMatchObject({
        testId: 'auth/login.spec.ts:should show error',
        totalRuns: 10,
        totalPassed: 7,
        totalFailed: 3,
        flakinessScore: 0.6,
      });
    });

    it('should order history by createdAt descending', async () => {
      const testId = encodeURIComponent('auth/login.spec.ts:should login successfully');

      const response = await request(app)
        .get(`/api/tests/${testId}/history`)
        .expect(200);

      const dates = response.body.history.map(
        (h: any) => new Date(h.createdAt).getTime()
      );
      expect(dates).toEqual([...dates].sort((a, b) => b - a));
    });

    it('should respect limit parameter', async () => {
      const testId = encodeURIComponent('auth/login.spec.ts:should login successfully');

      const response = await request(app)
        .get(`/api/tests/${testId}/history?limit=1`)
        .expect(200);

      expect(response.body.history.length).toBeLessThanOrEqual(1);
    });
  });
});
