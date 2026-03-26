import { describe, expect, it } from 'vitest';
import * as pageModule from './page';

describe('settings page module', () => {
  it('exports a default page component', () => {
    expect(typeof pageModule.default).toBe('function');
  });
});
