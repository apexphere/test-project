import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import runsRouter from '../src/routes/runs.js';

// Mock the database and services
vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    transaction: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn(),
    onConflictDoUpdate: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}));

vi.mock('../src/services/ingestion.js', () => ({
  ingestRun: vi.fn().mockResolvedValue({
    runId: '550e8400-e29b-41d4-a716-446655440000',
    testsReceived: 2,
    testsStored: 2,
  }),
  updateFlakinessScores: vi.fn().mockResolvedValue(undefined),
}));

// Create test app
const app = express();
app.use(express.json());
app.use('/api/runs', runsRouter);

describe('POST /api/runs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should accept a valid test run payload', async () => {
    const payload = {
      source: 'local',
      branch: 'develop',
      startedAt: '2026-02-07T10:00:00Z',
      completedAt: '2026-02-07T10:02:30Z',
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
          testId: 'auth/login.spec.ts:should show error on invalid credentials',
          title: 'should show error on invalid credentials',
          file: 'auth/login.spec.ts',
          status: 'failed',
          duration: 1234,
          retries: 1,
          error: {
            message: 'Expected element to be visible',
            stack: 'Error: Expected element to be visible\n    at test.spec.ts:10:5',
          },
        },
      ],
    };

    const response = await request(app)
      .post('/api/runs')
      .send(payload)
      .expect('Content-Type', /json/)
      .expect(201);

    expect(response.body).toHaveProperty('runId');
    expect(response.body.testsReceived).toBe(2);
    expect(response.body.testsStored).toBe(2);
  });

  it('should reject invalid source', async () => {
    const payload = {
      source: 'invalid',
      startedAt: '2026-02-07T10:00:00Z',
      completedAt: '2026-02-07T10:02:30Z',
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
      .expect('Content-Type', /json/)
      .expect(400);

    expect(response.body.error).toBe('Invalid payload');
  });

  it('should reject empty results array', async () => {
    const payload = {
      source: 'local',
      startedAt: '2026-02-07T10:00:00Z',
      completedAt: '2026-02-07T10:02:30Z',
      results: [],
    };

    const response = await request(app)
      .post('/api/runs')
      .send(payload)
      .expect('Content-Type', /json/)
      .expect(400);

    expect(response.body.error).toBe('Invalid payload');
  });

  it('should reject invalid status', async () => {
    const payload = {
      source: 'ci',
      startedAt: '2026-02-07T10:00:00Z',
      completedAt: '2026-02-07T10:02:30Z',
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
      .expect('Content-Type', /json/)
      .expect(400);

    expect(response.body.error).toBe('Invalid payload');
  });
});

describe('GET /api/runs/:runId', () => {
  it('should reject invalid UUID format', async () => {
    const response = await request(app)
      .get('/api/runs/invalid-id')
      .expect('Content-Type', /json/)
      .expect(400);

    expect(response.body.error).toBe('Invalid run ID format');
  });
});

describe('Schema Validation', () => {
  it('should accept optional fields', async () => {
    const payload = {
      source: 'ci',
      branch: 'feature/test',
      commitSha: 'a'.repeat(40),
      prNumber: 123,
      startedAt: '2026-02-07T10:00:00Z',
      completedAt: '2026-02-07T10:02:30Z',
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
