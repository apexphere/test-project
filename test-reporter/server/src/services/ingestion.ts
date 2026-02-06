import { db } from '../db/index.js';
import { runs, testResults, testStats } from '../db/schema.js';
import type { CreateRunInput } from '../schemas.js';
import { eq, sql } from 'drizzle-orm';

export interface IngestionResult {
  runId: string;
  testsReceived: number;
  testsStored: number;
}

export async function ingestRun(input: CreateRunInput): Promise<IngestionResult> {
  const startedAt = new Date(input.startedAt);
  const completedAt = new Date(input.completedAt);
  const durationMs = completedAt.getTime() - startedAt.getTime();

  // Calculate summary stats
  const passed = input.results.filter((r) => r.status === 'passed').length;
  const failed = input.results.filter((r) => r.status === 'failed').length;
  const skipped = input.results.filter((r) => r.status === 'skipped').length;

  // Insert run and results in a transaction
  const result = await db.transaction(async (tx) => {
    // Insert the run
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

    // Insert all test results
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

    // Update test stats for each unique test
    const uniqueTests = new Map<string, CreateRunInput['results'][0]>();
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

  return result;
}

export async function updateFlakinessScores(): Promise<void> {
  // Get all unique test IDs with enough runs
  const tests = await db.select({ testId: testStats.testId }).from(testStats);

  for (const { testId } of tests) {
    // Get the last 20 results for this test
    const results = await db
      .select({ status: testResults.status })
      .from(testResults)
      .where(eq(testResults.testId, testId))
      .orderBy(sql`${testResults.createdAt} DESC`)
      .limit(20);

    if (results.length < 2) continue;

    // Calculate flakiness score
    const passFailResults = results
      .map((r) => r.status)
      .filter((s) => s === 'passed' || s === 'failed') as ('passed' | 'failed')[];

    if (passFailResults.length < 2) continue;

    let transitions = 0;
    for (let i = 1; i < passFailResults.length; i++) {
      if (passFailResults[i] !== passFailResults[i - 1]) {
        transitions++;
      }
    }

    const flakinessScore = transitions / (passFailResults.length - 1);

    // Update the flakiness score
    await db
      .update(testStats)
      .set({ flakinessScore, updatedAt: new Date() })
      .where(eq(testStats.testId, testId));
  }
}
