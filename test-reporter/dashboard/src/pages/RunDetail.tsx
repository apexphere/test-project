import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api, type RunDetailResponse, type TestResult } from '../lib/api';
import { Card, StatCard } from '../components/Card';
import { StatusBadge } from '../components/Badge';
import { Table, type Column } from '../components/Table';

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${seconds}s`;
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

export function RunDetail() {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<RunDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'passed' | 'failed' | 'skipped'>('all');

  useEffect(() => {
    if (!runId) return;
    api
      .getRun(runId)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [runId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  if (!data) return null;

  const { run, results, summary } = data;

  const filteredResults =
    filter === 'all' ? results : results.filter((r) => r.status === filter);

  const passRate =
    summary.total > 0 ? ((summary.passed / summary.total) * 100).toFixed(1) : '0';

  const columns: Column<TestResult>[] = [
    {
      key: 'status',
      header: 'Status',
      render: (result) => <StatusBadge status={result.status} />,
      className: 'w-28',
    },
    {
      key: 'title',
      header: 'Test',
      render: (result) => (
        <div>
          <div className="font-medium text-gray-900">{result.title}</div>
          <div className="text-xs text-gray-500">{result.file}</div>
        </div>
      ),
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (result) => formatDuration(result.durationMs),
      className: 'w-24',
    },
    {
      key: 'retries',
      header: 'Retries',
      render: (result) =>
        result.retries > 0 ? (
          <span className="text-yellow-600">{result.retries}</span>
        ) : (
          <span className="text-gray-400">0</span>
        ),
      className: 'w-20',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/" className="hover:text-indigo-600">
          Dashboard
        </Link>
        <span>›</span>
        <span className="text-gray-900">Run #{run.id.slice(0, 8)}</span>
      </div>

      {/* Run Info */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-gray-500">Source</div>
            <div className="font-medium">{run.source}</div>
          </div>
          <div>
            <div className="text-gray-500">Branch</div>
            <div className="font-medium">{run.branch || '-'}</div>
          </div>
          <div>
            <div className="text-gray-500">Commit</div>
            <div className="font-mono text-xs">{run.commitSha?.slice(0, 7) || '-'}</div>
          </div>
          <div>
            <div className="text-gray-500">Started</div>
            <div>{formatDateTime(run.startedAt)}</div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total Tests" value={summary.total} />
        <StatCard label="Passed" value={summary.passed} />
        <StatCard label="Failed" value={summary.failed} />
        <StatCard label="Skipped" value={summary.skipped} />
        <StatCard label="Pass Rate" value={`${passRate}%`} />
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['all', 'passed', 'failed', 'skipped'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              filter === f
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === 'all' && ` (${results.length})`}
            {f === 'passed' && ` (${summary.passed})`}
            {f === 'failed' && ` (${summary.failed})`}
            {f === 'skipped' && ` (${summary.skipped})`}
          </button>
        ))}
      </div>

      {/* Results Table */}
      <Card>
        <Table
          columns={columns}
          data={filteredResults}
          keyExtractor={(result) => result.id}
          onRowClick={(result) =>
            navigate(`/tests/${encodeURIComponent(result.testId)}`)
          }
          emptyMessage="No test results"
        />
      </Card>

      {/* Failed Test Details */}
      {filter === 'failed' && filteredResults.length > 0 && (
        <Card title="Error Details">
          <div className="space-y-4">
            {filteredResults.map((result) => (
              <div key={result.id} className="border-b border-gray-100 pb-4 last:border-0">
                <div className="font-medium text-gray-900 mb-1">{result.title}</div>
                {result.errorMessage && (
                  <pre className="text-sm text-red-600 bg-red-50 p-3 rounded overflow-x-auto">
                    {result.errorMessage}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
