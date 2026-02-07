import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createDbMock, type DbMock } from './helpers/db-mock.js';
import insightsRouter from '../src/routes/insights.js';

// Mock data
const mockFlakyTests = [
  {
    testId: 'cart/checkout.spec.ts:should handle payment failure',
    title: 'should handle payment failure',
    file: 'cart/checkout.spec.ts',
    flakinessScore: 0.75,
    totalRuns: 20,
    totalPassed: 12,
    totalFailed: 8,
    lastRunAt: new Date('2026-02-07T10:00:00Z'),
    lastStatus: 'passed',
  },
];

const mockSlowTests = [
  {
    testId: 'search/product-search.spec.ts:should search products',
    title: 'should search products',
    file: 'search/product-search.spec.ts',
    avgDurationMs: 12300,
    minDurationMs: 8000,
    maxDurationMs: 18000,
    totalRuns: 25,
    lastRunAt: new Date('2026-02-07T10:00:00Z'),
  },
];

const mockRecentRuns = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    source: 'ci',
    branch: 'develop',
    commitSha: 'abc123def456'.padEnd(40, '0'),
    prNumber: null,
    startedAt: new Date('2026-02-07T10:00:00Z'),
    completedAt: new Date('2026-02-07T10:02:30Z'),
    totalTests: 19,
    passed: 19,
    failed: 0,
    skipped: 0,
    durationMs: 150000,
    createdAt: new Date('2026-02-07T10:02:30Z'),
  },
];

let dbMockHelper: DbMock;

// Mock the database
vi.mock('../src/db/index.js', () => ({
  get db() {
    return dbMockHelper?.db ?? {};
  },
}));

// Create test app
const app = express();
app.use(express.json());
app.use('/api/insights', insightsRouter);

describe('GET /api/insights/flaky', () => {
  beforeEach(() => {
    dbMockHelper = createDbMock();
    vi.clearAllMocks();
  });

  it('should return flaky tests sorted by flakiness score', async () => {
    dbMockHelper.setResolveSequence([mockFlakyTests]);

    const response = await request(app)
      .get('/api/insights/flaky')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('tests');
    expect(Array.isArray(response.body.tests)).toBe(true);
  });

  it('should accept minRuns parameter', async () => {
    dbMockHelper.setResolveSequence([mockFlakyTests]);

    const response = await request(app)
      .get('/api/insights/flaky?minRuns=10')
      .expect(200);

    expect(response.body).toHaveProperty('tests');
  });

  it('should accept limit parameter', async () => {
    dbMockHelper.setResolveSequence([mockFlakyTests]);

    const response = await request(app)
      .get('/api/insights/flaky?limit=5')
      .expect(200);

    expect(response.body).toHaveProperty('tests');
  });

  it('should reject invalid minRuns', async () => {
    const response = await request(app)
      .get('/api/insights/flaky?minRuns=0')
      .expect(400);

    expect(response.body.error).toBe('Invalid query parameters');
  });
});

describe('GET /api/insights/slow', () => {
  beforeEach(() => {
    dbMockHelper = createDbMock();
    vi.clearAllMocks();
  });

  it('should return slow tests sorted by average duration', async () => {
    dbMockHelper.setResolveSequence([mockSlowTests]);

    const response = await request(app)
      .get('/api/insights/slow')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('tests');
    expect(Array.isArray(response.body.tests)).toBe(true);
  });

  it('should accept limit parameter', async () => {
    dbMockHelper.setResolveSequence([mockSlowTests.slice(0, 1)]);

    const response = await request(app)
      .get('/api/insights/slow?limit=1')
      .expect(200);

    expect(response.body.tests).toHaveLength(1);
  });

  it('should reject limit exceeding maximum', async () => {
    const response = await request(app)
      .get('/api/insights/slow?limit=500')
      .expect(400);

    expect(response.body.error).toBe('Invalid query parameters');
  });
});

describe('GET /api/insights/overview', () => {
  beforeEach(() => {
    dbMockHelper = createDbMock();
    vi.clearAllMocks();
  });

  it('should return overview with all required fields', async () => {
    // Overview makes 7 DB calls in sequence:
    // 1. Total runs count
    // 2. Total tests count
    // 3. Pass rate aggregation
    // 4. Recent runs (limit)
    // 5. Previous runs (offset)
    // 6. Top flaky (limit)
    // 7. Top slow (limit)
    dbMockHelper.setResolveSequence([
      [{ count: 147 }],                                    // Total runs
      [{ count: 19 }],                                     // Total tests
      [{ totalPassed: 2700, totalTests: 2800 }],          // Pass rate
      mockRecentRuns,                                      // Recent runs
      [{ passed: 18, totalTests: 19 }],                   // Previous runs
      mockFlakyTests,                                      // Top flaky
      mockSlowTests,                                       // Top slow
    ]);

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

  it('should calculate trend correctly', async () => {
    dbMockHelper.setResolveSequence([
      [{ count: 100 }],
      [{ count: 10 }],
      [{ totalPassed: 900, totalTests: 1000 }],
      mockRecentRuns,
      [],  // No previous runs
      [],
      [],
    ]);

    const response = await request(app)
      .get('/api/insights/overview')
      .expect(200);

    expect(['improving', 'stable', 'declining']).toContain(response.body.trend);
  });
});
