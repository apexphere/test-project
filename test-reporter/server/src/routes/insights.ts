import { Router } from 'express';
import { db } from '../db/index.js';
import { testStats, runs } from '../db/schema.js';
import { flakyTestsQuerySchema, slowTestsQuerySchema } from '../schemas.js';
import { desc, sql, gte } from 'drizzle-orm';

const router: Router = Router();

/**
 * GET /api/insights/flaky
 * Get tests ranked by flakiness score
 */
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

/**
 * GET /api/insights/slow
 * Get slowest tests by average duration
 */
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

/**
 * GET /api/insights/overview
 * Dashboard overview data
 */
router.get('/overview', async (_req, res) => {
  try {
    // Get total runs count
    const [runsCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(runs);

    // Get total unique tests count
    const [testsCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(testStats);

    // Calculate overall pass rate from runs
    const [passRateResult] = await db
      .select({
        totalPassed: sql<number>`COALESCE(SUM(${runs.passed}), 0)::int`,
        totalTests: sql<number>`COALESCE(SUM(${runs.totalTests}), 0)::int`,
      })
      .from(runs);

    const overallPassRate = passRateResult.totalTests > 0
      ? Math.round((passRateResult.totalPassed / passRateResult.totalTests) * 10000) / 100
      : 0;

    // Calculate trend by comparing last 10 runs to previous 10 runs
    const recentRuns = await db
      .select({
        id: runs.id,
        source: runs.source,
        branch: runs.branch,
        commitSha: runs.commitSha,
        prNumber: runs.prNumber,
        startedAt: runs.startedAt,
        completedAt: runs.completedAt,
        totalTests: runs.totalTests,
        passed: runs.passed,
        failed: runs.failed,
        skipped: runs.skipped,
        durationMs: runs.durationMs,
        createdAt: runs.createdAt,
      })
      .from(runs)
      .orderBy(desc(runs.createdAt))
      .limit(10);

    const previousRuns = await db
      .select({
        passed: runs.passed,
        totalTests: runs.totalTests,
      })
      .from(runs)
      .orderBy(desc(runs.createdAt))
      .limit(10)
      .offset(10);

    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    
    if (recentRuns.length > 0 && previousRuns.length > 0) {
      const recentPassRate = recentRuns.reduce((sum, r) => sum + r.passed, 0) /
        Math.max(1, recentRuns.reduce((sum, r) => sum + r.totalTests, 0));
      const previousPassRate = previousRuns.reduce((sum, r) => sum + r.passed, 0) /
        Math.max(1, previousRuns.reduce((sum, r) => sum + r.totalTests, 0));

      const diff = recentPassRate - previousPassRate;
      if (diff > 0.05) {
        trend = 'improving';
      } else if (diff < -0.05) {
        trend = 'declining';
      }
    }

    // Get top 5 flaky tests
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

    // Get top 5 slow tests
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

export default router;
