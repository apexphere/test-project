import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { debounce } from './debounce';

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should delay function execution', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 300);

    debouncedFunc();
    expect(func).not.toHaveBeenCalled();

    vi.advanceTimersByTime(299);
    expect(func).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(func).toHaveBeenCalledTimes(1);
  });

  it('should only call the function once for multiple rapid calls', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 300);

    // Simulate typing "laptop" - 6 keystrokes
    debouncedFunc('l');
    vi.advanceTimersByTime(50);
    debouncedFunc('la');
    vi.advanceTimersByTime(50);
    debouncedFunc('lap');
    vi.advanceTimersByTime(50);
    debouncedFunc('lapt');
    vi.advanceTimersByTime(50);
    debouncedFunc('lapto');
    vi.advanceTimersByTime(50);
    debouncedFunc('laptop');

    // Function should not have been called yet
    expect(func).not.toHaveBeenCalled();

    // Wait for debounce to complete
    vi.advanceTimersByTime(300);

    // Should only be called once with the final value
    expect(func).toHaveBeenCalledTimes(1);
    expect(func).toHaveBeenCalledWith('laptop');
  });

  it('should pass arguments correctly', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 300);

    debouncedFunc('test', 123);
    vi.advanceTimersByTime(300);

    expect(func).toHaveBeenCalledWith('test', 123);
  });

  it('should cancel pending invocations', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 300);

    debouncedFunc();
    vi.advanceTimersByTime(150);
    debouncedFunc.cancel();
    vi.advanceTimersByTime(300);

    expect(func).not.toHaveBeenCalled();
  });

  it('should allow multiple separate debounced calls with sufficient delay', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 300);

    debouncedFunc('first');
    vi.advanceTimersByTime(300);
    expect(func).toHaveBeenCalledTimes(1);
    expect(func).toHaveBeenCalledWith('first');

    debouncedFunc('second');
    vi.advanceTimersByTime(300);
    expect(func).toHaveBeenCalledTimes(2);
    expect(func).toHaveBeenLastCalledWith('second');
  });

  it('should reset timer on each call', () => {
    const func = vi.fn();
    const debouncedFunc = debounce(func, 300);

    debouncedFunc();
    vi.advanceTimersByTime(200);
    expect(func).not.toHaveBeenCalled();

    // Call again - should reset the 300ms timer
    debouncedFunc();
    vi.advanceTimersByTime(200);
    expect(func).not.toHaveBeenCalled();

    // Now wait full 300ms
    vi.advanceTimersByTime(100);
    expect(func).toHaveBeenCalledTimes(1);
  });
});
