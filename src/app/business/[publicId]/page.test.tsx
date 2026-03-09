import { describe, it, expect } from 'vitest';
import * as pageModule from './page';

describe('page module smoke test', () => {
  it('exports a default page component', () => {
    expect(typeof pageModule.default).toBe('function');
  });
});
