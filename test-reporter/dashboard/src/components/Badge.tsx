type BadgeVariant = 'passed' | 'failed' | 'skipped' | 'timedOut' | 'flaky' | 'default';

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  passed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  skipped: 'bg-gray-100 text-gray-600',
  timedOut: 'bg-orange-100 text-orange-800',
  flaky: 'bg-yellow-100 text-yellow-800',
  default: 'bg-gray-100 text-gray-700',
};

export function Badge({ variant, children }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variantStyles[variant]}`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const variant = (['passed', 'failed', 'skipped', 'timedOut'].includes(status)
    ? status
    : 'default') as BadgeVariant;

  const labels: Record<string, string> = {
    passed: '✓ Passed',
    failed: '✗ Failed',
    skipped: '○ Skipped',
    timedOut: '⏱ Timeout',
  };

  return <Badge variant={variant}>{labels[status] || status}</Badge>;
}
