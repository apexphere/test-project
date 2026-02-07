import { vi } from 'vitest';

/**
 * Creates a comprehensive mock for Drizzle ORM database operations.
 * The mock supports chained method calls and can be configured to return
 * specific values in sequence.
 */
export function createDbMock() {
  const resolveSequence: unknown[] = [];
  let callIndex = 0;

  const getNextValue = () => {
    const value = resolveSequence[callIndex] ?? [];
    callIndex++;
    return Promise.resolve(value);
  };

  // Create a mock that supports all chainable methods
  const createChainable = (): Record<string, unknown> => {
    const self: Record<string, unknown> = {};

    const chainableMethods = [
      'select',
      'from',
      'where',
      'orderBy',
      'groupBy',
      'having',
      'innerJoin',
      'leftJoin',
      'rightJoin',
      'fullJoin',
    ];

    const terminalMethods = ['limit', 'offset'];

    // Each chainable method returns the same object for chaining
    for (const method of chainableMethods) {
      self[method] = vi.fn(() => self);
    }

    // Terminal methods that can resolve the promise
    for (const method of terminalMethods) {
      self[method] = vi.fn(() => {
        // Return an object that's also thenable and chainable
        const result = { ...self, then: (fn: (val: unknown) => void) => getNextValue().then(fn) };
        return result;
      });
    }

    // Make the object itself thenable for queries that end with from/where/etc
    self.then = (fn: (val: unknown) => void) => getNextValue().then(fn);

    return self;
  };

  const dbMock = createChainable();

  return {
    db: dbMock,
    reset: () => {
      callIndex = 0;
      resolveSequence.length = 0;
    },
    setResolveSequence: (values: unknown[]) => {
      callIndex = 0;
      resolveSequence.length = 0;
      resolveSequence.push(...values);
    },
  };
}

export type DbMock = ReturnType<typeof createDbMock>;
