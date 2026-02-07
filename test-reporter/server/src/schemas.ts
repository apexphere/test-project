import { z } from 'zod';

// Test result status enum
export const testStatusSchema = z.enum(['passed', 'failed', 'skipped', 'timedOut']);
export type TestStatus = z.infer<typeof testStatusSchema>;

// Individual test result in a submission
export const testResultInputSchema = z.object({
  testId: z.string().min(1).max(500),
  title: z.string().min(1).max(500),
  file: z.string().min(1).max(500),
  status: testStatusSchema,
  duration: z.number().int().min(0),
  retries: z.number().int().min(0).default(0),
  error: z
    .object({
      message: z.string(),
      stack: z.string().optional(),
    })
    .nullable()
    .optional(),
  annotations: z.array(z.string()).optional(),
});

export type TestResultInput = z.infer<typeof testResultInputSchema>;

// Create run request body
export const createRunSchema = z.object({
  runId: z.string().uuid().optional(),
  source: z.enum(['ci', 'local']),
  branch: z.string().max(255).optional(),
  commitSha: z.string().length(40).optional(),
  prNumber: z.number().int().positive().optional(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime(),
  results: z.array(testResultInputSchema).min(1),
});

export type CreateRunInput = z.infer<typeof createRunSchema>;

// Query params for listing runs
export const listRunsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  branch: z.string().optional(),
  status: z.enum(['passed', 'failed']).optional(),
});

export type ListRunsQuery = z.infer<typeof listRunsQuerySchema>;

// Query params for listing tests
export const listTestsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  orderBy: z.enum(['flakiness', 'avgDuration', 'failRate', 'name']).default('name'),
  order: z.enum(['asc', 'desc']).default('asc'),
});

export type ListTestsQuery = z.infer<typeof listTestsQuerySchema>;

// Query params for test history
export const testHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type TestHistoryQuery = z.infer<typeof testHistoryQuerySchema>;

// Query params for flaky tests insight
export const flakyTestsQuerySchema = z.object({
  minRuns: z.coerce.number().int().min(1).default(5),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type FlakyTestsQuery = z.infer<typeof flakyTestsQuerySchema>;

// Query params for slow tests insight
export const slowTestsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type SlowTestsQuery = z.infer<typeof slowTestsQuerySchema>;
