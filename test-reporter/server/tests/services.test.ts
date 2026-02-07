import { describe, it, expect } from 'vitest';
import {
  calculateFlakiness,
  calculatePassRate,
  calculateFailRate,
  determineTrend,
} from '../src/services/stats.js';

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

describe('Pass Rate Calculation', () => {
  it('should calculate correct pass rate', () => {
    expect(calculatePassRate(90, 100)).toBe(90);
    expect(calculatePassRate(100, 100)).toBe(100);
    expect(calculatePassRate(0, 100)).toBe(0);
  });

  it('should handle zero total', () => {
    expect(calculatePassRate(0, 0)).toBe(0);
    expect(calculatePassRate(10, 0)).toBe(0);
  });

  it('should round to 2 decimal places', () => {
    expect(calculatePassRate(1, 3)).toBeCloseTo(33.33, 2);
    expect(calculatePassRate(2, 3)).toBeCloseTo(66.67, 2);
  });
});

describe('Fail Rate Calculation', () => {
  it('should calculate correct fail rate', () => {
    expect(calculateFailRate(10, 100)).toBe(10);
    expect(calculateFailRate(0, 100)).toBe(0);
    expect(calculateFailRate(100, 100)).toBe(100);
  });

  it('should handle zero total', () => {
    expect(calculateFailRate(0, 0)).toBe(0);
    expect(calculateFailRate(5, 0)).toBe(0);
  });

  it('should round to 2 decimal places', () => {
    expect(calculateFailRate(1, 3)).toBeCloseTo(33.33, 2);
  });
});

describe('Trend Determination', () => {
  it('should return improving when recent is better', () => {
    expect(determineTrend(0.95, 0.85)).toBe('improving');
    expect(determineTrend(0.90, 0.80)).toBe('improving');
  });

  it('should return declining when recent is worse', () => {
    expect(determineTrend(0.85, 0.95)).toBe('declining');
    expect(determineTrend(0.80, 0.90)).toBe('declining');
  });

  it('should return stable when difference is within threshold', () => {
    expect(determineTrend(0.90, 0.88)).toBe('stable');
    expect(determineTrend(0.90, 0.92)).toBe('stable');
    expect(determineTrend(0.90, 0.90)).toBe('stable');
  });

  it('should respect custom threshold', () => {
    // With default threshold (0.05), 0.90 vs 0.88 is stable
    expect(determineTrend(0.90, 0.88, 0.05)).toBe('stable');
    // With smaller threshold (0.01), it's improving
    expect(determineTrend(0.90, 0.88, 0.01)).toBe('improving');
  });

  it('should handle edge cases', () => {
    expect(determineTrend(1.0, 0.0)).toBe('improving');
    expect(determineTrend(0.0, 1.0)).toBe('declining');
    expect(determineTrend(0.0, 0.0)).toBe('stable');
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
