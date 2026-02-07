import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

interface PassRateChartProps {
  data: Array<{
    date: string;
    passRate: number;
  }>;
}

export function PassRateChart({ data }: PassRateChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: '#6b7280' }}
          tickLine={false}
          axisLine={{ stroke: '#e5e7eb' }}
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 12, fill: '#6b7280' }}
          tickLine={false}
          axisLine={{ stroke: '#e5e7eb' }}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Pass Rate']}
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            fontSize: '12px',
          }}
        />
        <Line
          type="monotone"
          dataKey="passRate"
          stroke="#10b981"
          strokeWidth={2}
          dot={{ fill: '#10b981', strokeWidth: 0, r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

interface DurationChartProps {
  data: Array<{
    date: string;
    duration: number;
  }>;
}

export function DurationChart({ data }: DurationChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: '#6b7280' }}
          tickLine={false}
          axisLine={{ stroke: '#e5e7eb' }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: '#6b7280' }}
          tickLine={false}
          axisLine={{ stroke: '#e5e7eb' }}
          tickFormatter={(v) => `${(v / 1000).toFixed(1)}s`}
        />
        <Tooltip
          formatter={(value) => [`${(Number(value) / 1000).toFixed(2)}s`, 'Duration']}
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            fontSize: '12px',
          }}
        />
        <Line
          type="monotone"
          dataKey="duration"
          stroke="#6366f1"
          strokeWidth={2}
          dot={{ fill: '#6366f1', strokeWidth: 0, r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
