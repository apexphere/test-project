import { Router } from 'express';
import { db } from '../db/index.js';
import { testStats, testResults } from '../db/schema.js';
import { listTestsQuerySchema, testHistoryQuerySchema } from '../schemas.js';
import { eq, desc, asc, sql } from 'drizzle-orm';

const router: Router = Router();

/**
 * GET /api/tests
 * List all unique tests with aggregated stats
 */
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

    // Build order clause
    let orderClause;
    switch (orderBy) {
      case 'flakiness':
        orderClause = order === 'desc' ? desc(testStats.flakinessScore) : asc(testStats.flakinessScore);
        break;
      case 'avgDuration':
        orderClause = order === 'desc' ? desc(testStats.avgDurationMs) : asc(testStats.avgDurationMs);
        break;
      case 'failRate':
        // Calculate fail rate: totalFailed / totalRuns
        orderClause = order === 'desc'
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
        // Calculate pass rate and fail rate
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

/**
 * GET /api/tests/:testId/history
 * Get historical results for a specific test
 */
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

    // Get the test stats
    const [test] = await db
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
      })
      .from(testStats)
      .where(eq(testStats.testId, decodedTestId));

    if (!test) {
      return res.status(404).json({ error: 'Test not found' });
    }

    // Get the history of results
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

    return res.json({
      test,
      history,
    });
  } catch (error) {
    console.error('Failed to get test history:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
