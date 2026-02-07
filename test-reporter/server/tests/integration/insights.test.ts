/**
 * Integration tests for Insights API
 * - GET /api/insights/overview
 * - GET /api/insights/flaky
 * - GET /api/insights/slow
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

describe('Insights API', () => {
  let app: Express;

  beforeAll(async () => {
    await setupTestDb();
    app = await createTestApp();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await cleanTestData();
    await seedTestData();
  });

  describe('GET /api/insights/overview', () => {
    it('should return dashboard overview data', async () => {
      const response = await request(app)
        .get('/api/insights/overview')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('totalRuns');
      expect(response.body).toHaveProperty('totalTests');
      expect(response.body).toHaveProperty('overallPassRate');
      expect(response.body).toHaveProperty('trend');
      expect(response.body).toHaveProperty('recentRuns');
      expect(response.body).toHaveProperty('topFlaky');
      expect(response.body).toHaveProperty('topSlow');
    });

    it('should return correct counts', async () => {
      const response = await request(app)
        .get('/api/insights/overview')
        .expect(200);

      expect(response.body.totalRuns).toBe(2); // 2 seeded runs
      expect(response.body.totalTests).toBe(4); // 4 seeded test stats
    });

    it('should return valid trend value', async () => {
      const response = await request(app)
        .get('/api/insights/overview')
        .expect(200);

      expect(['improving', 'stable', 'declining']).toContain(response.body.trend);
    });

    it('should return recent runs array', async () => {
      const response = await request(app)
        .get('/api/insights/overview')
        .expect(200);

      expect(Array.isArray(response.body.recentRuns)).toBe(true);
      expect(response.body.recentRuns.length).toBe(2);
    });

    it('should return top flaky tests (minRuns >= 5)', async () => {
      const response = await request(app)
        .get('/api/insights/overview')
        .expect(200);

      expect(Array.isArray(response.body.topFlaky)).toBe(true);
      // All topFlaky tests should have >= 5 runs
      response.body.topFlaky.forEach((test: any) => {
        expect(test.totalRuns).toBeGreaterThanOrEqual(5);
      });
    });

    it('should return top slow tests', async () => {
      const response = await request(app)
        .get('/api/insights/overview')
        .expect(200);

      expect(Array.isArray(response.body.topSlow)).toBe(true);
      // Slowest test should be first
      if (response.body.topSlow.length > 1) {
        expect(response.body.topSlow[0].avgDurationMs).toBeGreaterThanOrEqual(
          response.body.topSlow[1].avgDurationMs
        );
      }
    });

    it('should calculate overall pass rate correctly', async () => {
      const response = await request(app)
        .get('/api/insights/overview')
        .expect(200);

      // Seeded data: run1 (2 passed, 1 failed = 3 total), run2 (2 passed, 0 failed = 2 total)
      // Total: 4 passed out of 5 = 80%
      expect(response.body.overallPassRate).toBe(80);
    });
  });

  describe('GET /api/insights/flaky', () => {
    it('should return flaky tests ranked by score', async () => {
      const response = await request(app)
        .get('/api/insights/flaky')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('tests');
      expect(Array.isArray(response.body.tests)).toBe(true);
    });

    it('should filter by minRuns', async () => {
      const response = await request(app)
        .get('/api/insights/flaky?minRuns=10')
        .expect(200);

      // Only tests with >= 10 runs should be returned
      response.body.tests.forEach((test: any) => {
        expect(test.totalRuns).toBeGreaterThanOrEqual(10);
      });
    });

    it('should order by flakiness score descending', async () => {
      const response = await request(app)
        .get('/api/insights/flaky?minRuns=5')
        .expect(200);

      const scores = response.body.tests.map((t: any) => t.flakinessScore);
      expect(scores).toEqual([...scores].sort((a, b) => b - a));
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/insights/flaky?limit=2')
        .expect(200);

      expect(response.body.tests.length).toBeLessThanOrEqual(2);
    });

    it('should include flaky test with 0.6 score', async () => {
      const response = await request(app)
        .get('/api/insights/flaky?minRuns=5')
        .expect(200);

      const flakyTest = response.body.tests.find(
        (t: any) => t.testId === 'auth/login.spec.ts:should show error'
      );
      expect(flakyTest).toBeDefined();
      expect(flakyTest.flakinessScore).toBe(0.6);
    });

    it('should include required fields in response', async () => {
      const response = await request(app)
        .get('/api/insights/flaky')
        .expect(200);

      if (response.body.tests.length > 0) {
        const test = response.body.tests[0];
        expect(test).toHaveProperty('testId');
        expect(test).toHaveProperty('title');
        expect(test).toHaveProperty('file');
        expect(test).toHaveProperty('flakinessScore');
        expect(test).toHaveProperty('totalRuns');
        expect(test).toHaveProperty('totalPassed');
        expect(test).toHaveProperty('totalFailed');
        expect(test).toHaveProperty('lastRunAt');
        expect(test).toHaveProperty('lastStatus');
      }
    });
  });

  describe('GET /api/insights/slow', () => {
    it('should return slow tests ranked by duration', async () => {
      const response = await request(app)
        .get('/api/insights/slow')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('tests');
      expect(Array.isArray(response.body.tests)).toBe(true);
    });

    it('should order by avgDurationMs descending', async () => {
      const response = await request(app)
        .get('/api/insights/slow')
        .expect(200);

      const durations = response.body.tests.map((t: any) => t.avgDurationMs);
      expect(durations).toEqual([...durations].sort((a, b) => b - a));
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/insights/slow?limit=2')
        .expect(200);

      expect(response.body.tests.length).toBeLessThanOrEqual(2);
    });

    it('should include the slowest test (15000ms)', async () => {
      const response = await request(app)
        .get('/api/insights/slow')
        .expect(200);

      const slowTest = response.body.tests.find(
        (t: any) => t.testId === 'checkout/payment.spec.ts:slow test'
      );
      expect(slowTest).toBeDefined();
      expect(slowTest.avgDurationMs).toBe(15000);
    });

    it('should return slowest test first', async () => {
      const response = await request(app)
        .get('/api/insights/slow')
        .expect(200);

      // The seeded slow test (15000ms) should be first
      expect(response.body.tests[0].avgDurationMs).toBe(15000);
    });

    it('should include required fields in response', async () => {
      const response = await request(app)
        .get('/api/insights/slow')
        .expect(200);

      if (response.body.tests.length > 0) {
        const test = response.body.tests[0];
        expect(test).toHaveProperty('testId');
        expect(test).toHaveProperty('title');
        expect(test).toHaveProperty('file');
        expect(test).toHaveProperty('avgDurationMs');
        expect(test).toHaveProperty('minDurationMs');
        expect(test).toHaveProperty('maxDurationMs');
        expect(test).toHaveProperty('totalRuns');
        expect(test).toHaveProperty('lastRunAt');
      }
    });
  });
});
