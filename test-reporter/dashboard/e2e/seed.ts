/**
 * Seed test data for E2E tests via the API.
 * This creates test runs with predictable data for assertions.
 */

const API_BASE = process.env.API_URL || 'http://localhost:3000';

export interface SeedData {
  runIds: string[];
  testIds: string[];
}

async function submitRun(runData: {
  source: string;
  branch: string;
  commitSha?: string;
  startedAt: string;
  completedAt: string;
  results: Array<{
    testId: string;
    title: string;
    file: string;
    status: 'passed' | 'failed' | 'skipped';
    duration: number;
    retries?: number;
    errorMessage?: string;
  }>;
}): Promise<string> {
  const response = await fetch(`${API_BASE}/api/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(runData),
  });

  if (!response.ok) {
    throw new Error(`Failed to seed run: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.run.id;
}

export async function seedTestData(): Promise<SeedData> {
  const now = new Date();
  const runIds: string[] = [];
  const testIds = [
    'auth/login.spec.ts:should login successfully',
    'auth/login.spec.ts:should show error on invalid credentials',
    'cart/add-item.spec.ts:should add item to cart',
    'cart/checkout.spec.ts:should complete checkout',
    'products/list.spec.ts:should display products',
  ];

  // Create 3 test runs with varying results
  for (let i = 0; i < 3; i++) {
    const startedAt = new Date(now.getTime() - (i + 1) * 3600000); // 1, 2, 3 hours ago
    const completedAt = new Date(startedAt.getTime() + 120000); // 2 min duration

    const runId = await submitRun({
      source: 'ci',
      branch: 'develop',
      commitSha: `abc${i}def`,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      results: [
        {
          testId: testIds[0],
          title: 'should login successfully',
          file: 'auth/login.spec.ts',
          status: 'passed',
          duration: 2345,
        },
        {
          testId: testIds[1],
          title: 'should show error on invalid credentials',
          file: 'auth/login.spec.ts',
          status: i === 0 ? 'failed' : 'passed', // First run has a failure
          duration: 1234,
          retries: i === 0 ? 1 : 0,
          errorMessage: i === 0 ? 'Expected error message to be visible' : undefined,
        },
        {
          testId: testIds[2],
          title: 'should add item to cart',
          file: 'cart/add-item.spec.ts',
          status: 'passed',
          duration: 3456,
        },
        {
          testId: testIds[3],
          title: 'should complete checkout',
          file: 'cart/checkout.spec.ts',
          status: 'skipped',
          duration: 0,
        },
        {
          testId: testIds[4],
          title: 'should display products',
          file: 'products/list.spec.ts',
          status: 'passed',
          duration: 5678 + i * 1000, // Variable duration for slow test detection
        },
      ],
    });

    runIds.push(runId);
  }

  // Create additional runs to populate flaky test detection
  // Alternating pass/fail creates high flakiness score
  for (let i = 0; i < 4; i++) {
    const startedAt = new Date(now.getTime() - (i + 5) * 3600000);
    const completedAt = new Date(startedAt.getTime() + 60000);

    await submitRun({
      source: 'ci',
      branch: 'develop',
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      results: [
        {
          testId: 'flaky/unstable.spec.ts:flaky test',
          title: 'flaky test',
          file: 'flaky/unstable.spec.ts',
          status: i % 2 === 0 ? 'passed' : 'failed', // Alternating
          duration: 1000,
          retries: i % 2 === 0 ? 0 : 2,
          errorMessage: i % 2 !== 0 ? 'Random failure' : undefined,
        },
      ],
    });
  }

  console.log(`Seeded ${runIds.length} test runs`);
  return { runIds, testIds };
}

export async function waitForApi(maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${API_BASE}/api/health`);
      if (response.ok) {
        console.log('API is ready');
        return;
      }
    } catch {
      // Continue waiting
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('API did not become ready in time');
}
