import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api, type TestHistoryResponse } from '../lib/api';
import { Card, StatCard } from '../components/Card';
import { StatusBadge, Badge } from '../components/Badge';
import { Table, type Column } from '../components/Table';
import { DurationChart } from '../components/Chart';

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${seconds}s`;
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

export function TestDetail() {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<TestHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!testId) return;
    api
      .getTestHistory(testId)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [testId]);

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

  const { test, history } = data;

  const passRate =
    test.totalRuns > 0
      ? ((test.totalPassed / test.totalRuns) * 100).toFixed(1)
      : '0';

  // Prepare duration chart data
  const durationChartData = [...history]
    .reverse()
    .map((h) => ({
      date: new Date(h.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      duration: h.durationMs,
    }));

  type HistoryItem = (typeof history)[0];
  
  const historyColumns: Column<HistoryItem>[] = [
    {
      key: 'status',
      header: 'Status',
      render: (h) => <StatusBadge status={h.status} />,
      className: 'w-28',
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (h) => formatDuration(h.durationMs),
      className: 'w-24',
    },
    {
      key: 'retries',
      header: 'Retries',
      render: (h) =>
        h.retries > 0 ? (
          <span className="text-yellow-600">{h.retries}</span>
        ) : (
          <span className="text-gray-400">0</span>
        ),
      className: 'w-20',
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (h) => formatDateTime(h.createdAt),
    },
    {
      key: 'runId',
      header: 'Run',
      render: (h) => (
        <span className="font-mono text-xs text-gray-500">
          {h.runId.slice(0, 8)}
        </span>
      ),
    },
  ];

  const isFlaky = test.flakinessScore >= 0.2;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/" className="hover:text-indigo-600">
          Dashboard
        </Link>
        <span>›</span>
        <span className="text-gray-900 truncate max-w-md">{test.title}</span>
      </div>

      {/* Test Info */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{test.title}</h1>
            <p className="text-sm text-gray-500 mt-1">{test.file}</p>
          </div>
          <div className="flex gap-2">
            {isFlaky && <Badge variant="flaky">Flaky</Badge>}
            {test.lastStatus && <StatusBadge status={test.lastStatus} />}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total Runs" value={test.totalRuns} />
        <StatCard label="Pass Rate" value={`${passRate}%`} />
        <StatCard
          label="Flakiness"
          value={test.flakinessScore.toFixed(2)}
          trend={isFlaky ? 'down' : 'stable'}
        />
        <StatCard label="Avg Duration" value={formatDuration(test.avgDurationMs)} />
        <StatCard
          label="Duration Range"
          value={`${formatDuration(test.minDurationMs || 0)} - ${formatDuration(test.maxDurationMs || 0)}`}
        />
      </div>

      {/* Duration Trend Chart */}
      <Card title="Duration Over Time">
        <DurationChart data={durationChartData} />
      </Card>

      {/* History Table */}
      <Card title="Run History">
        <Table
          columns={historyColumns}
          data={history}
          keyExtractor={(h) => h.id}
          onRowClick={(h) => navigate(`/runs/${h.runId}`)}
          emptyMessage="No history available"
        />
      </Card>

      {/* Error Details for Failed Runs */}
      {history.some((h) => h.errorMessage) && (
        <Card title="Recent Errors">
          <div className="space-y-4">
            {history
              .filter((h) => h.errorMessage)
              .slice(0, 5)
              .map((h) => (
                <div key={h.id} className="border-b border-gray-100 pb-4 last:border-0">
                  <div className="text-sm text-gray-500 mb-1">
                    {formatDateTime(h.createdAt)}
                  </div>
                  <pre className="text-sm text-red-600 bg-red-50 p-3 rounded overflow-x-auto">
                    {h.errorMessage}
                  </pre>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}
