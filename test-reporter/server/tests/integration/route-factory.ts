/**
 * Route factory for integration tests.
 * Creates routes with injected database for testing.
 */

import { Router } from 'express';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../src/db/schema.js';
import { runs, testResults, testStats } from '../../src/db/schema.js';
import {
  createRunSchema,
  listRunsQuerySchema,
  listTestsQuerySchema,
  testHistoryQuerySchema,
  flakyTestsQuerySchema,
  slowTestsQuerySchema,
} from '../../src/schemas.js';
import { eq, desc, asc, sql, and, gte } from 'drizzle-orm';

type Db = NodePgDatabase<typeof schema>;

/**
 * Create all API routes with the provided database instance.
 */
export function createRoutes(db: Db): Router {
  const router = Router();

  // Mount sub-routers
  router.use('/runs', createRunsRouter(db));
  router.use('/tests', createTestsRouter(db));
  router.use('/insights', createInsightsRouter(db));

  // Health check
  router.get('/health', async (_, res) => {
    const startTime = Date.now();
    try {
      await db.execute(sql`SELECT 1`);
      const responseTimeMs = Date.now() - startTime;
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'connected',
        responseTimeMs,
      });
    } catch {
      const responseTimeMs = Date.now() - startTime;
      res.status(503).json({
        status: 'degraded',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
        responseTimeMs,
      });
    }
  });

  return router;
}

function createRunsRouter(db: Db): Router {
  const router = Router();

  // POST /api/runs - Submit a test run
  router.post('/', async (req, res) => {
    try {
      const parseResult = createRunSchema.safeParse(req.body);

      if (!parseResult.success) {
        return res.status(400).json({
          error: 'Invalid payload',
          details: parseResult.error.flatten(),
        });
      }

      const input = parseResult.data;
      const startedAt = new Date(input.startedAt);
      const completedAt = new Date(input.completedAt);
      const durationMs = completedAt.getTime() - startedAt.getTime();

      const passed = input.results.filter((r) => r.status === 'passed').length;
      const failed = input.results.filter((r) => r.status === 'failed').length;
      const skipped = input.results.filter((r) => r.status === 'skipped').length;

      const result = await db.transaction(async (tx) => {
        const [run] = await tx
          .insert(runs)
          .values({
            id: input.runId,
            source: input.source,
            branch: input.branch,
            commitSha: input.commitSha,
            prNumber: input.prNumber,
            startedAt,
            completedAt,
            totalTests: input.results.length,
            passed,
            failed,
            skipped,
            durationMs,
          })
          .returning({ id: runs.id });

        const insertedResults = await tx
          .insert(testResults)
          .values(
            input.results.map((r) => ({
              runId: run.id,
              testId: r.testId,
              title: r.title,
              file: r.file,
              status: r.status,
              durationMs: r.duration,
              retries: r.retries,
              errorMessage: r.error?.message,
              errorStack: r.error?.stack,
            }))
          )
          .returning({ id: testResults.id });

        // Update test stats
        const uniqueTests = new Map<string, typeof input.results[0]>();
        for (const result of input.results) {
          uniqueTests.set(result.testId, result);
        }

        for (const [testId, testResult] of uniqueTests) {
          await tx
            .insert(testStats)
            .values({
              testId,
              title: testResult.title,
              file: testResult.file,
              totalRuns: 1,
              totalPassed: testResult.status === 'passed' ? 1 : 0,
              totalFailed: testResult.status === 'failed' ? 1 : 0,
              totalSkipped: testResult.status === 'skipped' ? 1 : 0,
              avgDurationMs: testResult.duration,
              minDurationMs: testResult.duration,
              maxDurationMs: testResult.duration,
              lastRunAt: completedAt,
              lastStatus: testResult.status,
            })
            .onConflictDoUpdate({
              target: testStats.testId,
              set: {
                totalRuns: sql`${testStats.totalRuns} + 1`,
                totalPassed: sql`${testStats.totalPassed} + ${testResult.status === 'passed' ? 1 : 0}`,
                totalFailed: sql`${testStats.totalFailed} + ${testResult.status === 'failed' ? 1 : 0}`,
                totalSkipped: sql`${testStats.totalSkipped} + ${testResult.status === 'skipped' ? 1 : 0}`,
                avgDurationMs: sql`(${testStats.avgDurationMs} * ${testStats.totalRuns} + ${testResult.duration}) / (${testStats.totalRuns} + 1)`,
                minDurationMs: sql`LEAST(COALESCE(${testStats.minDurationMs}, ${testResult.duration}), ${testResult.duration})`,
                maxDurationMs: sql`GREATEST(COALESCE(${testStats.maxDurationMs}, ${testResult.duration}), ${testResult.duration})`,
                lastRunAt: completedAt,
                lastStatus: testResult.status,
                updatedAt: sql`CURRENT_TIMESTAMP`,
              },
            });
        }

        return {
          runId: run.id,
          testsReceived: input.results.length,
          testsStored: insertedResults.length,
        };
      });

      return res.status(201).json(result);
    } catch (error) {
      console.error('Failed to ingest run:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/runs - List runs
  router.get('/', async (req, res) => {
    try {
      const parseResult = listRunsQuerySchema.safeParse(req.query);

      if (!parseResult.success) {
        return res.status(400).json({
          error: 'Invalid query parameters',
          details: parseResult.error.flatten(),
        });
      }

      const { limit, offset, branch, status } = parseResult.data;

      const conditions = [];
      if (branch) {
        conditions.push(eq(runs.branch, branch));
      }
      if (status === 'passed') {
        conditions.push(eq(runs.failed, 0));
      } else if (status === 'failed') {
        conditions.push(sql`${runs.failed} > 0`);
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const runsList = await db
        .select()
        .from(runs)
        .where(whereClause)
        .orderBy(desc(runs.createdAt))
        .limit(limit)
        .offset(offset);

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(runs)
        .where(whereClause);

      return res.json({
        runs: runsList,
        total: count,
        hasMore: offset + runsList.length < count,
      });
    } catch (error) {
      console.error('Failed to list runs:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/runs/:runId - Get specific run
  router.get('/:runId', async (req, res) => {
    try {
      const { runId } = req.params;

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(runId)) {
        return res.status(400).json({ error: 'Invalid run ID format' });
      }

      const [run] = await db.select().from(runs).where(eq(runs.id, runId));

      if (!run) {
        return res.status(404).json({ error: 'Run not found' });
      }

      const results = await db
        .select()
        .from(testResults)
        .where(eq(testResults.runId, runId))
        .orderBy(testResults.file, testResults.title);

      return res.json({
        run,
        results,
        summary: {
          total: run.totalTests,
          passed: run.passed,
          failed: run.failed,
          skipped: run.skipped,
          duration: run.durationMs,
        },
      });
    } catch (error) {
      console.error('Failed to get run:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

function createTestsRouter(db: Db): Router {
  const router = Router();

  // GET /api/tests - List tests with stats
  router.get('/', async (req, res) => {
    try {
      const parseResult = listTestsQuerySchema.safeParse(req.query);

      if (!parseResult.success) {
        return res.status(400).json({
          error: 'Invalid query parameters',
          details: parseResult.error.flatten(),
        });
      }

      const { limit, orderBy, order } = parseResult.data;

      let orderClause;
      switch (orderBy) {
        case 'flakiness':
          orderClause = order === 'desc' ? desc(testStats.flakinessScore) : asc(testStats.flakinessScore);
          break;
        case 'avgDuration':
          orderClause = order === 'desc' ? desc(testStats.avgDurationMs) : asc(testStats.avgDurationMs);
          break;
        case 'failRate':
          orderClause =
            order === 'desc'
              ? desc(sql`CASE WHEN ${testStats.totalRuns} > 0 THEN ${testStats.totalFailed}::float / ${testStats.totalRuns} ELSE 0 END`)
              : asc(sql`CASE WHEN ${testStats.totalRuns} > 0 THEN ${testStats.totalFailed}::float / ${testStats.totalRuns} ELSE 0 END`);
          break;
        case 'name':
        default:
          orderClause = order === 'desc' ? desc(testStats.title) : asc(testStats.title);
          break;
      }

      const tests = await db
        .select({
          testId: testStats.testId,
          title: testStats.title,
          file: testStats.file,
          totalRuns: testStats.totalRuns,
          totalPassed: testStats.totalPassed,
          totalFailed: testStats.totalFailed,
          totalSkipped: testStats.totalSkipped,
          avgDurationMs: testStats.avgDurationMs,
          minDurationMs: testStats.minDurationMs,
          maxDurationMs: testStats.maxDurationMs,
          flakinessScore: testStats.flakinessScore,
          lastRunAt: testStats.lastRunAt,
          lastStatus: testStats.lastStatus,
          passRate: sql<number>`CASE WHEN ${testStats.totalRuns} > 0 THEN ROUND((${testStats.totalPassed}::numeric / ${testStats.totalRuns}) * 100, 2) ELSE 0 END`,
          failRate: sql<number>`CASE WHEN ${testStats.totalRuns} > 0 THEN ROUND((${testStats.totalFailed}::numeric / ${testStats.totalRuns}) * 100, 2) ELSE 0 END`,
        })
        .from(testStats)
        .orderBy(orderClause)
        .limit(limit);

      return res.json({ tests });
    } catch (error) {
      console.error('Failed to list tests:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/tests/:testId/history
  router.get('/:testId/history', async (req, res) => {
    try {
      const { testId } = req.params;
      const decodedTestId = decodeURIComponent(testId);

      const parseResult = testHistoryQuerySchema.safeParse(req.query);

      if (!parseResult.success) {
        return res.status(400).json({
          error: 'Invalid query parameters',
          details: parseResult.error.flatten(),
        });
      }

      const { limit } = parseResult.data;

      const [test] = await db
        .select()
        .from(testStats)
        .where(eq(testStats.testId, decodedTestId));

      if (!test) {
        return res.status(404).json({ error: 'Test not found' });
      }

      const history = await db
        .select({
          id: testResults.id,
          runId: testResults.runId,
          status: testResults.status,
          durationMs: testResults.durationMs,
          retries: testResults.retries,
          errorMessage: testResults.errorMessage,
          errorStack: testResults.errorStack,
          createdAt: testResults.createdAt,
        })
        .from(testResults)
        .where(eq(testResults.testId, decodedTestId))
        .orderBy(desc(testResults.createdAt))
        .limit(limit);

      return res.json({ test, history });
    } catch (error) {
      console.error('Failed to get test history:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

function createInsightsRouter(db: Db): Router {
  const router = Router();

  // GET /api/insights/overview
  router.get('/overview', async (_req, res) => {
    try {
      const [runsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(runs);
      const [testsCount] = await db.select({ count: sql<number>`count(*)::int` }).from(testStats);

      const [passRateResult] = await db
        .select({
          totalPassed: sql<number>`COALESCE(SUM(${runs.passed}), 0)::int`,
          totalTests: sql<number>`COALESCE(SUM(${runs.totalTests}), 0)::int`,
        })
        .from(runs);

      const overallPassRate =
        passRateResult.totalTests > 0
          ? Math.round((passRateResult.totalPassed / passRateResult.totalTests) * 10000) / 100
          : 0;

      const recentRuns = await db
        .select()
        .from(runs)
        .orderBy(desc(runs.createdAt))
        .limit(10);

      const previousRuns = await db
        .select({ passed: runs.passed, totalTests: runs.totalTests })
        .from(runs)
        .orderBy(desc(runs.createdAt))
        .limit(10)
        .offset(10);

      let trend: 'improving' | 'stable' | 'declining' = 'stable';
      if (recentRuns.length > 0 && previousRuns.length > 0) {
        const recentPassRate =
          recentRuns.reduce((sum, r) => sum + r.passed, 0) /
          Math.max(1, recentRuns.reduce((sum, r) => sum + r.totalTests, 0));
        const previousPassRate =
          previousRuns.reduce((sum, r) => sum + r.passed, 0) /
          Math.max(1, previousRuns.reduce((sum, r) => sum + r.totalTests, 0));

        const diff = recentPassRate - previousPassRate;
        if (diff > 0.05) {
          trend = 'improving';
        } else if (diff < -0.05) {
          trend = 'declining';
        }
      }

      const topFlaky = await db
        .select({
          testId: testStats.testId,
          title: testStats.title,
          file: testStats.file,
          flakinessScore: testStats.flakinessScore,
          totalRuns: testStats.totalRuns,
        })
        .from(testStats)
        .where(gte(testStats.totalRuns, 5))
        .orderBy(desc(testStats.flakinessScore))
        .limit(5);

      const topSlow = await db
        .select({
          testId: testStats.testId,
          title: testStats.title,
          file: testStats.file,
          avgDurationMs: testStats.avgDurationMs,
        })
        .from(testStats)
        .orderBy(desc(testStats.avgDurationMs))
        .limit(5);

      return res.json({
        totalRuns: runsCount.count,
        totalTests: testsCount.count,
        overallPassRate,
        trend,
        recentRuns,
        topFlaky,
        topSlow,
      });
    } catch (error) {
      console.error('Failed to get overview:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/insights/flaky
  router.get('/flaky', async (req, res) => {
    try {
      const parseResult = flakyTestsQuerySchema.safeParse(req.query);

      if (!parseResult.success) {
        return res.status(400).json({
          error: 'Invalid query parameters',
          details: parseResult.error.flatten(),
        });
      }

      const { minRuns, limit } = parseResult.data;

      const tests = await db
        .select({
          testId: testStats.testId,
          title: testStats.title,
          file: testStats.file,
          flakinessScore: testStats.flakinessScore,
          totalRuns: testStats.totalRuns,
          totalPassed: testStats.totalPassed,
          totalFailed: testStats.totalFailed,
          lastRunAt: testStats.lastRunAt,
          lastStatus: testStats.lastStatus,
        })
        .from(testStats)
        .where(gte(testStats.totalRuns, minRuns))
        .orderBy(desc(testStats.flakinessScore))
        .limit(limit);

      return res.json({ tests });
    } catch (error) {
      console.error('Failed to get flaky tests:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  // GET /api/insights/slow
  router.get('/slow', async (req, res) => {
    try {
      const parseResult = slowTestsQuerySchema.safeParse(req.query);

      if (!parseResult.success) {
        return res.status(400).json({
          error: 'Invalid query parameters',
          details: parseResult.error.flatten(),
        });
      }

      const { limit } = parseResult.data;

      const tests = await db
        .select({
          testId: testStats.testId,
          title: testStats.title,
          file: testStats.file,
          avgDurationMs: testStats.avgDurationMs,
          minDurationMs: testStats.minDurationMs,
          maxDurationMs: testStats.maxDurationMs,
          totalRuns: testStats.totalRuns,
          lastRunAt: testStats.lastRunAt,
        })
        .from(testStats)
        .orderBy(desc(testStats.avgDurationMs))
        .limit(limit);

      return res.json({ tests });
    } catch (error) {
      console.error('Failed to get slow tests:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}
