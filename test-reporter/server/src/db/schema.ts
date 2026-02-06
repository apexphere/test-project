import {
  pgTable,
  uuid,
  varchar,
  integer,
  text,
  timestamp,
  serial,
  real,
  index,
} from 'drizzle-orm/pg-core';

// Test Runs (one per Playwright execution)
export const runs = pgTable(
  'runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    source: varchar('source', { length: 20 }).notNull(), // "ci" | "local"
    branch: varchar('branch', { length: 255 }),
    commitSha: varchar('commit_sha', { length: 40 }),
    prNumber: integer('pr_number'),
    startedAt: timestamp('started_at').notNull(),
    completedAt: timestamp('completed_at').notNull(),
    totalTests: integer('total_tests').notNull(),
    passed: integer('passed').notNull(),
    failed: integer('failed').notNull(),
    skipped: integer('skipped').notNull(),
    durationMs: integer('duration_ms').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    branchIdx: index('idx_runs_branch').on(table.branch),
    createdIdx: index('idx_runs_created').on(table.createdAt),
  })
);

// Individual Test Results
export const testResults = pgTable(
  'test_results',
  {
    id: serial('id').primaryKey(),
    runId: uuid('run_id')
      .notNull()
      .references(() => runs.id, { onDelete: 'cascade' }),
    testId: varchar('test_id', { length: 500 }).notNull(), // Stable identifier: "file:title"
    title: varchar('title', { length: 500 }).notNull(),
    file: varchar('file', { length: 500 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(), // passed|failed|skipped|timedOut
    durationMs: integer('duration_ms').notNull(),
    retries: integer('retries').default(0).notNull(),
    errorMessage: text('error_message'),
    errorStack: text('error_stack'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    runIdx: index('idx_results_run').on(table.runId),
    testIdx: index('idx_results_test').on(table.testId),
  })
);

// Aggregated Test Stats (materialized for performance)
export const testStats = pgTable(
  'test_stats',
  {
    testId: varchar('test_id', { length: 500 }).primaryKey(),
    title: varchar('title', { length: 500 }).notNull(),
    file: varchar('file', { length: 500 }).notNull(),
    totalRuns: integer('total_runs').default(0).notNull(),
    totalPassed: integer('total_passed').default(0).notNull(),
    totalFailed: integer('total_failed').default(0).notNull(),
    totalSkipped: integer('total_skipped').default(0).notNull(),
    avgDurationMs: real('avg_duration_ms').default(0).notNull(),
    minDurationMs: integer('min_duration_ms'),
    maxDurationMs: integer('max_duration_ms'),
    flakinessScore: real('flakiness_score').default(0).notNull(), // 0.0 (stable) to 1.0 (very flaky)
    lastRunAt: timestamp('last_run_at'),
    lastStatus: varchar('last_status', { length: 20 }),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    flakinessIdx: index('idx_stats_flakiness').on(table.flakinessScore),
    durationIdx: index('idx_stats_duration').on(table.avgDurationMs),
  })
);

// Type exports for use in application code
export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;
export type TestResult = typeof testResults.$inferSelect;
export type NewTestResult = typeof testResults.$inferInsert;
export type TestStats = typeof testStats.$inferSelect;
export type NewTestStats = typeof testStats.$inferInsert;
