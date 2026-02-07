/**
 * Flakiness score: 0.0 (completely stable) to 1.0 (completely random)
 *
 * Algorithm:
 * 1. Look at recent runs (default: last 20)
 * 2. Count "transitions" (pass→fail or fail→pass)
 * 3. More transitions = higher flakiness
 *
 * Examples:
 * - [P,P,P,P,P] = 0.0 (stable pass)
 * - [F,F,F,F,F] = 0.0 (stable fail)
 * - [P,F,P,F,P] = 1.0 (maximum flakiness)
 * - [P,P,P,F,P] = 0.5 (somewhat flaky - 2 transitions in 4 gaps)
 */
export function calculateFlakiness(results: ('passed' | 'failed')[]): number {
  if (results.length < 2) return 0;

  let transitions = 0;
  for (let i = 1; i < results.length; i++) {
    if (results[i] !== results[i - 1]) {
      transitions++;
    }
  }

  // Maximum possible transitions = results.length - 1
  return transitions / (results.length - 1);
}

/**
 * Calculate pass rate as a percentage
 */
export function calculatePassRate(passed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((passed / total) * 10000) / 100;
}

/**
 * Calculate fail rate as a percentage
 */
export function calculateFailRate(failed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((failed / total) * 10000) / 100;
}

/**
 * Determine trend direction based on pass rates
 * @param recentPassRate Pass rate of recent runs (0-1)
 * @param previousPassRate Pass rate of previous runs (0-1)
 * @param threshold Minimum difference to consider a trend (default 0.05 = 5%)
 */
export function determineTrend(
  recentPassRate: number,
  previousPassRate: number,
  threshold: number = 0.05
): 'improving' | 'stable' | 'declining' {
  const diff = recentPassRate - previousPassRate;
  if (diff > threshold) {
    return 'improving';
  } else if (diff < -threshold) {
    return 'declining';
  }
  return 'stable';
}
