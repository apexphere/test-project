import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type OverviewData, type Run } from '../lib/api';
import { Card, StatCard } from '../components/Card';
import { Table, type Column } from '../components/Table';
import { PassRateChart } from '../components/Chart';

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${seconds}s`;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getOverview()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

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

  // Prepare chart data from recent runs
  const chartData = [...data.recentRuns]
    .reverse()
    .map((run) => ({
      date: new Date(run.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      passRate: run.totalTests > 0 ? (run.passed / run.totalTests) * 100 : 0,
    }));

  const runColumns: Column<Run>[] = [
    {
      key: 'id',
      header: 'Run',
      render: (run) => (
        <span className="font-mono text-xs">#{run.id.slice(0, 8)}</span>
      ),
    },
    { key: 'branch', header: 'Branch', render: (run) => run.branch || '-' },
    {
      key: 'commit',
      header: 'Commit',
      render: (run) => (
        <span className="font-mono text-xs">{run.commitSha?.slice(0, 7) || '-'}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (run) => (
        <span className={run.failed === 0 ? 'text-green-600' : 'text-red-600'}>
          {run.failed === 0 ? '✓' : '✗'} {run.passed}/{run.totalTests} passed
        </span>
      ),
    },
    {
      key: 'duration',
      header: 'Duration',
      render: (run) => formatDuration(run.durationMs),
    },
    {
      key: 'time',
      header: 'Time',
      render: (run) => formatTimeAgo(run.createdAt),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Runs" value={data.totalRuns} />
        <StatCard label="Pass Rate" value={`${data.overallPassRate}%`} />
        <StatCard label="Total Tests" value={data.totalTests} />
        <StatCard
          label="Trend"
          value={data.trend === 'improving' ? '↗' : data.trend === 'declining' ? '↘' : '→'}
          trend={data.trend === 'improving' ? 'up' : data.trend === 'declining' ? 'down' : 'stable'}
        />
      </div>

      {/* Pass Rate Chart */}
      <Card title="Pass Rate Over Time">
        <PassRateChart data={chartData} />
      </Card>

      {/* Flaky and Slow Tests */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="🔥 Flaky Tests">
          {data.topFlaky.length === 0 ? (
            <p className="text-sm text-gray-500">No flaky tests detected</p>
          ) : (
            <ul className="space-y-2">
              {data.topFlaky.map((test, i) => (
                <li key={test.testId} className="flex items-center justify-between text-sm">
                  <Link
                    to={`/tests/${encodeURIComponent(test.testId)}`}
                    className="text-gray-700 hover:text-indigo-600 truncate flex-1"
                  >
                    {i + 1}. {test.title}
                  </Link>
                  <span className="text-yellow-600 font-mono ml-2">
                    {test.flakinessScore.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="🐢 Slowest Tests">
          {data.topSlow.length === 0 ? (
            <p className="text-sm text-gray-500">No test data available</p>
          ) : (
            <ul className="space-y-2">
              {data.topSlow.map((test, i) => (
                <li key={test.testId} className="flex items-center justify-between text-sm">
                  <Link
                    to={`/tests/${encodeURIComponent(test.testId)}`}
                    className="text-gray-700 hover:text-indigo-600 truncate flex-1"
                  >
                    {i + 1}. {test.title}
                  </Link>
                  <span className="text-gray-500 font-mono ml-2">
                    {(test.avgDurationMs / 1000).toFixed(1)}s
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Recent Runs Table */}
      <Card title="Recent Runs">
        <Table
          columns={runColumns}
          data={data.recentRuns}
          keyExtractor={(run) => run.id}
          onRowClick={(run) => navigate(`/runs/${run.id}`)}
          emptyMessage="No test runs yet"
        />
      </Card>
    </div>
  );
}
