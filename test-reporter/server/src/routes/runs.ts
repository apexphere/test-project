import { Router } from 'express';
import { db } from '../db/index.js';
import { runs, testResults } from '../db/schema.js';
import { createRunSchema, listRunsQuerySchema } from '../schemas.js';
import { ingestRun, updateFlakinessScores } from '../services/ingestion.js';
import { eq, desc, sql, and } from 'drizzle-orm';

const router: Router = Router();

/**
 * POST /api/runs
 * Submit a new test run
 */
router.post('/', async (req, res) => {
  try {
    const parseResult = createRunSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Invalid payload',
        details: parseResult.error.flatten(),
      });
    }

    const result = await ingestRun(parseResult.data);

    // Update flakiness scores in the background
    updateFlakinessScores().catch((err) => {
      console.error('Failed to update flakiness scores:', err);
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error('Failed to ingest run:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/runs
 * List test runs with pagination and filtering
 */
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

    // Build conditions
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

    // Get runs
    const runsList = await db
      .select()
      .from(runs)
      .where(whereClause)
      .orderBy(desc(runs.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
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

/**
 * GET /api/runs/:runId
 * Get a specific run with all test results
 */
router.get('/:runId', async (req, res) => {
  try {
    const { runId } = req.params;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(runId)) {
      return res.status(400).json({ error: 'Invalid run ID format' });
    }

    // Get the run
    const [run] = await db.select().from(runs).where(eq(runs.id, runId));

    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }

    // Get all results for this run
    const results = await db
      .select()
      .from(testResults)
      .where(eq(testResults.runId, runId))
      .orderBy(testResults.file, testResults.title);

    // Calculate summary
    const summary = {
      total: run.totalTests,
      passed: run.passed,
      failed: run.failed,
      skipped: run.skipped,
      duration: run.durationMs,
    };

    return res.json({
      run,
      results,
      summary,
    });
  } catch (error) {
    console.error('Failed to get run:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
