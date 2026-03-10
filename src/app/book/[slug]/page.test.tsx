import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('public booking page source', () => {
  it('supports grouped services accordion and ungrouped fallback section', () => {
    const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

    expect(source).toContain('groupServicesForDisplay');
    expect(source).toContain('Other Services');
    expect(source).toContain('ServiceOptionCard');
  });
});
