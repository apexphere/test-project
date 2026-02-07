/**
 * Integration tests for Health API (GET /api/health)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import {
  setupTestDb,
  teardownTestDb,
  createTestApp,
} from './setup.js';

describe('Health API - GET /api/health', () => {
  let app: Express;

  beforeAll(async () => {
    await setupTestDb();
    app = await createTestApp();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('When database is connected', () => {
    it('should return 200 OK', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.status).toBe('ok');
    });

    it('should report database as connected', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.database).toBe('connected');
    });

    it('should include timestamp in ISO format', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.timestamp).toBeDefined();
      // Validate ISO date format
      expect(new Date(response.body.timestamp).toISOString()).toBe(response.body.timestamp);
    });

    it('should include responseTimeMs', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body.responseTimeMs).toBeDefined();
      expect(typeof response.body.responseTimeMs).toBe('number');
      expect(response.body.responseTimeMs).toBeGreaterThanOrEqual(0);
    });
  });
});
