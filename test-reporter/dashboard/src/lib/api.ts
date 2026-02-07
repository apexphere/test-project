const API_BASE = import.meta.env.VITE_API_URL || '';

export interface Run {
  id: string;
  source: string;
  branch: string | null;
  commitSha: string | null;
  prNumber: number | null;
  startedAt: string;
  completedAt: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  durationMs: number;
  createdAt: string;
}

export interface TestResult {
  id: number;
  runId: string;
  testId: string;
  title: string;
  file: string;
  status: 'passed' | 'failed' | 'skipped' | 'timedOut';
  durationMs: number;
  retries: number;
  errorMessage: string | null;
  errorStack: string | null;
  createdAt: string;
}

export interface TestSummary {
  testId: string;
  title: string;
  file: string;
  totalRuns: number;
  totalPassed: number;
  totalFailed: number;
  totalSkipped: number;
  avgDurationMs: number;
  minDurationMs: number | null;
  maxDurationMs: number | null;
  flakinessScore: number;
  lastRunAt: string | null;
  lastStatus: string | null;
  passRate?: number;
  failRate?: number;
}

export interface FlakyTest {
  testId: string;
  title: string;
  file: string;
  flakinessScore: number;
  totalRuns: number;
  totalPassed?: number;
  totalFailed?: number;
  lastRunAt: string | null;
  lastStatus?: string | null;
}

export interface SlowTest {
  testId: string;
  title: string;
  file: string;
  avgDurationMs: number;
  minDurationMs?: number | null;
  maxDurationMs?: number | null;
  totalRuns?: number;
  lastRunAt?: string | null;
}

export interface OverviewData {
  totalRuns: number;
  totalTests: number;
  overallPassRate: number;
  trend: 'improving' | 'stable' | 'declining';
  recentRuns: Run[];
  topFlaky: FlakyTest[];
  topSlow: SlowTest[];
}

export interface RunsResponse {
  runs: Run[];
  total: number;
  hasMore: boolean;
}

export interface RunDetailResponse {
  run: Run;
  results: TestResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  };
}

export interface TestHistoryResponse {
  test: TestSummary;
  history: Array<{
    id: number;
    runId: string;
    status: string;
    durationMs: number;
    retries: number;
    errorMessage: string | null;
    errorStack: string | null;
    createdAt: string;
  }>;
}

async function fetchApi<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return response.json();
}

export const api = {
  getOverview: () => fetchApi<OverviewData>('/api/insights/overview'),
  
  getRuns: (params?: { limit?: number; offset?: number; branch?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    if (params?.branch) searchParams.set('branch', params.branch);
    const query = searchParams.toString();
    return fetchApi<RunsResponse>(`/api/runs${query ? `?${query}` : ''}`);
  },
  
  getRun: (runId: string) => fetchApi<RunDetailResponse>(`/api/runs/${runId}`),
  
  getTests: (params?: { limit?: number; orderBy?: string; order?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.orderBy) searchParams.set('orderBy', params.orderBy);
    if (params?.order) searchParams.set('order', params.order);
    const query = searchParams.toString();
    return fetchApi<{ tests: TestSummary[] }>(`/api/tests${query ? `?${query}` : ''}`);
  },
  
  getTestHistory: (testId: string, params?: { limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const query = searchParams.toString();
    return fetchApi<TestHistoryResponse>(
      `/api/tests/${encodeURIComponent(testId)}/history${query ? `?${query}` : ''}`
    );
  },
  
  getFlakyTests: (params?: { minRuns?: number; limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.minRuns) searchParams.set('minRuns', String(params.minRuns));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const query = searchParams.toString();
    return fetchApi<{ tests: FlakyTest[] }>(`/api/insights/flaky${query ? `?${query}` : ''}`);
  },
  
  getSlowTests: (params?: { limit?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const query = searchParams.toString();
    return fetchApi<{ tests: SlowTest[] }>(`/api/insights/slow${query ? `?${query}` : ''}`);
  },
};
