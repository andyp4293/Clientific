import { describe, it, expect } from 'vitest';
import * as routeModule from './route';

const METHOD_EXPORTS = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'] as const;

describe('route module smoke test', () => {
  it('exports at least one HTTP handler function', () => {
    const handlers = METHOD_EXPORTS.filter((method) => typeof (routeModule as Record<string, unknown>)[method] === 'function');
    expect(handlers.length).toBeGreaterThan(0);
  });
});