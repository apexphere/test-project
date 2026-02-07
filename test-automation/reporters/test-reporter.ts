/**
 * Custom Playwright Reporter for test-reporter service integration.
 *
 * This reporter collects test results during the run and POSTs them to the
 * test-reporter service on completion. It handles connection errors gracefully
 * so that tests never fail due to reporter issues.
 *
 * Environment variables:
 *   TEST_REPORTER_URL  — Base URL of the test-reporter service
 *                        (e.g., http://localhost:3000)
 *
 * If TEST_REPORTER_URL is not set, the reporter does nothing.
 */

import type {
  Reporter,
  FullConfig,
  Suite,
  TestCase,
  TestResult as PlaywrightTestResult,
  FullResult,
} from '@playwright/test/reporter';

/** Test result payload matching test-reporter API schema */
interface TestResultPayload {
  testId: string;
  title: string;
  file: string;
  status: 'passed' | 'failed' | 'skipped' | 'timedOut';
  duration: number;
  retries: number;
  error: { message: string; stack?: string } | null;
  annotations?: string[];
}

/** Run submission payload matching test-reporter API schema */
interface RunPayload {
  source: 'ci' | 'local';
  branch?: string;
  commitSha?: string;
  prNumber?: number;
  startedAt: string;
  completedAt: string;
  results: TestResultPayload[];
}

/** API response from POST /api/runs */
interface CreateRunResponse {
  runId: string;
  testsReceived: number;
  testsStored: number;
}

/**
 * Maps Playwright test status to test-reporter status.
 * Playwright uses 'expected'/'unexpected' for pass/fail with retries,
 * but also has 'passed', 'failed', 'skipped', 'timedOut' on individual results.
 */
function mapStatus(
  status: PlaywrightTestResult['status']
): TestResultPayload['status'] {
  switch (status) {
    case 'passed':
      return 'passed';
    case 'failed':
      return 'failed';
    case 'skipped':
      return 'skipped';
    case 'timedOut':
      return 'timedOut';
    case 'interrupted':
      // Treat interrupted as failed
      return 'failed';
    default:
      return 'failed';
  }
}

/**
 * Extracts a relative file path from the full test location.
 * Removes the project root to get a clean identifier.
 */
function extractRelativeFile(test: TestCase): string {
  // test.location.file is the absolute path
  // We want something like "tests/auth/login.spec.ts"
  const fullPath = test.location.file;
  const testsIndex = fullPath.indexOf('/tests/');
  if (testsIndex !== -1) {
    return fullPath.slice(testsIndex + 1); // Remove leading slash
  }
  // Fallback: just use the filename
  return fullPath.split('/').slice(-2).join('/');
}

/**
 * Builds a stable test ID from file path and title hierarchy.
 * Example: "tests/auth/login.spec.ts:Login Page > should login successfully"
 */
function buildTestId(test: TestCase): string {
  const file = extractRelativeFile(test);
  const titlePath = test.titlePath().slice(1).join(' > '); // Skip the project name
  return `${file}:${titlePath}`;
}

class TestReporterReporter implements Reporter {
  private results: TestResultPayload[] = [];
  private startTime: Date = new Date();
  private reporterUrl: string | undefined;

  constructor() {
    this.reporterUrl = process.env.TEST_REPORTER_URL;
  }

  onBegin(_config: FullConfig, _suite: Suite): void {
    this.startTime = new Date();
    this.results = [];

    if (!this.reporterUrl) {
      console.log(
        '[test-reporter] TEST_REPORTER_URL not set, skipping result collection'
      );
    }
  }

  onTestEnd(test: TestCase, result: PlaywrightTestResult): void {
    if (!this.reporterUrl) {
      return;
    }

    const testResult: TestResultPayload = {
      testId: buildTestId(test),
      title: test.title,
      file: extractRelativeFile(test),
      status: mapStatus(result.status),
      duration: result.duration,
      retries: result.retry,
      error: result.error
        ? {
            message: result.error.message || 'Unknown error',
            stack: result.error.stack,
          }
        : null,
      annotations: test.annotations.map((a) =>
        a.description ? `${a.type}: ${a.description}` : a.type
      ),
    };

    this.results.push(testResult);
  }

  async onEnd(_result: FullResult): Promise<void> {
    if (!this.reporterUrl) {
      return;
    }

    if (this.results.length === 0) {
      console.log('[test-reporter] No test results to submit');
      return;
    }

    const payload: RunPayload = {
      source: process.env.CI ? 'ci' : 'local',
      branch: process.env.GITHUB_REF_NAME || process.env.GITHUB_HEAD_REF,
      commitSha: process.env.GITHUB_SHA,
      prNumber: process.env.GITHUB_PR_NUMBER
        ? parseInt(process.env.GITHUB_PR_NUMBER, 10)
        : undefined,
      startedAt: this.startTime.toISOString(),
      completedAt: new Date().toISOString(),
      results: this.results,
    };

    // Filter out undefined values
    if (!payload.branch) delete payload.branch;
    if (!payload.commitSha) delete payload.commitSha;
    if (!payload.prNumber) delete payload.prNumber;

    await this.submitResults(payload);
  }

  /**
   * Submits test results to the test-reporter service.
   * Handles errors gracefully — logs warnings but never throws.
   */
  private async submitResults(payload: RunPayload): Promise<void> {
    const url = `${this.reporterUrl}/api/runs`;

    try {
      console.log(
        `[test-reporter] Submitting ${payload.results.length} test results to ${url}`
      );

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout (fail-open)

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.warn(
          `[test-reporter] Failed to submit results: ${response.status} ${response.statusText}`
        );
        console.warn(`[test-reporter] Response: ${errorText}`);
        return;
      }

      const data = (await response.json()) as CreateRunResponse;
      console.log(
        `[test-reporter] Successfully submitted run ${data.runId} (${data.testsStored}/${data.testsReceived} tests stored)`
      );
    } catch (error: unknown) {
      // Graceful degradation: log the error but don't fail the test run
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.warn('[test-reporter] Request timed out after 5 seconds (fail-open: tests will pass)');
        } else if (
          error.message.includes('ECONNREFUSED') ||
          error.message.includes('fetch failed')
        ) {
          console.warn(
            `[test-reporter] Could not connect to ${url} — is the test-reporter service running?`
          );
        } else {
          console.warn(`[test-reporter] Failed to submit results: ${error.message}`);
        }
      } else {
        console.warn('[test-reporter] Failed to submit results: Unknown error');
      }
    }
  }
}

export default TestReporterReporter;
