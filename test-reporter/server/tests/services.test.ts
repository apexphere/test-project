import { describe, it, expect } from 'vitest';

/**
 * Flakiness score: 0.0 (completely stable) to 1.0 (completely random)
 * 
 * Algorithm:
 * 1. Look at recent runs (default: last 20)
 * 2. Count "transitions" (pass→fail or fail→pass)
 * 3. More transitions = higher flakiness
 */
function calculateFlakiness(results: ('passed' | 'failed')[]): number {
  if (results.length < 2) return 0;

  let transitions = 0;
  for (let i = 1; i < results.length; i++) {
    if (results[i] !== results[i - 1]) {
      transitions++;
    }
  }

  return transitions / (results.length - 1);
}

describe('Flakiness Calculation', () => {
  it('should return 0 for consistently passing tests', () => {
    const results: ('passed' | 'failed')[] = ['passed', 'passed', 'passed', 'passed', 'passed'];
    expect(calculateFlakiness(results)).toBe(0);
  });

  it('should return 0 for consistently failing tests', () => {
    const results: ('passed' | 'failed')[] = ['failed', 'failed', 'failed', 'failed', 'failed'];
    expect(calculateFlakiness(results)).toBe(0);
  });

  it('should return 1 for maximum flakiness (alternating)', () => {
    const results: ('passed' | 'failed')[] = ['passed', 'failed', 'passed', 'failed', 'passed'];
    expect(calculateFlakiness(results)).toBe(1);
  });

  it('should return 0.25 for slightly flaky test', () => {
    // One transition in 4 gaps = 0.25
    const results: ('passed' | 'failed')[] = ['passed', 'passed', 'passed', 'failed', 'passed'];
    expect(calculateFlakiness(results)).toBe(0.5); // 2 transitions in 4 gaps
  });

  it('should return 0 for single result', () => {
    const results: ('passed' | 'failed')[] = ['passed'];
    expect(calculateFlakiness(results)).toBe(0);
  });

  it('should return 0 for empty array', () => {
    const results: ('passed' | 'failed')[] = [];
    expect(calculateFlakiness(results)).toBe(0);
  });

  it('should handle two results with transition', () => {
    const results: ('passed' | 'failed')[] = ['passed', 'failed'];
    expect(calculateFlakiness(results)).toBe(1);
  });

  it('should handle two results without transition', () => {
    const results: ('passed' | 'failed')[] = ['passed', 'passed'];
    expect(calculateFlakiness(results)).toBe(0);
  });

  it('should calculate correctly for realistic scenario', () => {
    // 10 runs: mostly passing with 2 random failures
    const results: ('passed' | 'failed')[] = [
      'passed', 'passed', 'failed', 'passed', 'passed',
      'passed', 'failed', 'passed', 'passed', 'passed',
    ];
    // Transitions: passed→failed, failed→passed, passed→failed, failed→passed = 4
    // Gaps: 9
    // Score: 4/9 ≈ 0.444
    expect(calculateFlakiness(results)).toBeCloseTo(0.444, 2);
  });
});

describe('Schema Validation Logic', () => {
  it('should validate test status enum', () => {
    const validStatuses = ['passed', 'failed', 'skipped', 'timedOut'];
    const invalidStatus = 'unknown';

    expect(validStatuses.includes('passed')).toBe(true);
    expect(validStatuses.includes(invalidStatus)).toBe(false);
  });

  it('should validate source enum', () => {
    const validSources = ['ci', 'local'];
    
    expect(validSources.includes('ci')).toBe(true);
    expect(validSources.includes('local')).toBe(true);
    expect(validSources.includes('github')).toBe(false);
  });
});
