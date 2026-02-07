import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createDbMock, type DbMock } from './helpers/db-mock.js';
import testsRouter from '../src/routes/tests.js';

// Mock data
const mockTestStats = [
  {
    testId: 'auth/login.spec.ts:should login successfully',
    title: 'should login successfully',
    file: 'auth/login.spec.ts',
    totalRuns: 10,
    totalPassed: 9,
    totalFailed: 1,
    totalSkipped: 0,
    avgDurationMs: 2500,
    minDurationMs: 2000,
    maxDurationMs: 3000,
    flakinessScore: 0.2,
    lastRunAt: new Date('2026-02-07T10:00:00Z'),
    lastStatus: 'passed',
    passRate: 90,
    failRate: 10,
  },
];

const mockTestHistory = [
  {
    id: 1,
    runId: '550e8400-e29b-41d4-a716-446655440001',
    status: 'passed',
    durationMs: 2345,
    retries: 0,
    errorMessage: null,
    errorStack: null,
    createdAt: new Date('2026-02-07T10:00:00Z'),
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
app.use('/api/tests', testsRouter);

describe('GET /api/tests', () => {
  beforeEach(() => {
    dbMockHelper = createDbMock();
    vi.clearAllMocks();
  });

  it('should return list of tests with default ordering', async () => {
    dbMockHelper.setResolveSequence([mockTestStats]);

    const response = await request(app)
      .get('/api/tests')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('tests');
    expect(Array.isArray(response.body.tests)).toBe(true);
  });

  it('should accept valid query parameters', async () => {
    dbMockHelper.setResolveSequence([mockTestStats]);

    const response = await request(app)
      .get('/api/tests?limit=10&orderBy=flakiness&order=desc')
      .expect(200);

    expect(response.body).toHaveProperty('tests');
  });

  it('should reject invalid orderBy value', async () => {
    const response = await request(app)
      .get('/api/tests?orderBy=invalid')
      .expect(400);

    expect(response.body.error).toBe('Invalid query parameters');
  });

  it('should reject invalid order value', async () => {
    const response = await request(app)
      .get('/api/tests?order=invalid')
      .expect(400);

    expect(response.body.error).toBe('Invalid query parameters');
  });

  it('should reject limit exceeding maximum', async () => {
    const response = await request(app)
      .get('/api/tests?limit=200')
      .expect(400);

    expect(response.body.error).toBe('Invalid query parameters');
  });
});

describe('GET /api/tests/:testId/history', () => {
  beforeEach(() => {
    dbMockHelper = createDbMock();
    vi.clearAllMocks();
  });

  it('should return test with history', async () => {
    dbMockHelper.setResolveSequence([mockTestStats, mockTestHistory]);

    const testId = encodeURIComponent('auth/login.spec.ts:should login successfully');
    const response = await request(app)
      .get(`/api/tests/${testId}/history`)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('test');
    expect(response.body).toHaveProperty('history');
  });

  it('should return 404 for non-existent test', async () => {
    dbMockHelper.setResolveSequence([[]]);

    const testId = encodeURIComponent('nonexistent/test.spec.ts:test');
    const response = await request(app)
      .get(`/api/tests/${testId}/history`)
      .expect(404);

    expect(response.body.error).toBe('Test not found');
  });

  it('should accept custom limit parameter', async () => {
    dbMockHelper.setResolveSequence([mockTestStats, mockTestHistory]);

    const testId = encodeURIComponent('auth/login.spec.ts:should login successfully');
    const response = await request(app)
      .get(`/api/tests/${testId}/history?limit=10`)
      .expect(200);

    expect(response.body).toHaveProperty('test');
    expect(response.body).toHaveProperty('history');
  });

  it('should handle URL-encoded test IDs', async () => {
    dbMockHelper.setResolveSequence([mockTestStats, mockTestHistory]);

    // Test with special characters that need encoding
    const testId = encodeURIComponent('auth/login.spec.ts:should login with email@example.com');
    const response = await request(app)
      .get(`/api/tests/${testId}/history`)
      .expect(200);

    expect(response.body).toHaveProperty('test');
  });
});
