import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as pageModule from './page';

describe('business hours page', () => {
  it('exports a default page component', () => {
    expect(typeof pageModule.default).toBe('function');
  });

  it('includes a specific closed dates management section', () => {
    const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

    expect(source).toContain('Business Hours & Closures');
    expect(source).toContain('Weekly Hours');
    expect(source).toContain('Closed Dates');
    expect(source).toContain('Specific Closed Dates');
    expect(source).toContain('Add Closed Date');
    expect(source).toContain('Online booking and your AI receptionist');
    expect(source).toContain('Holiday and one-off closures');
    expect(source).toContain('<DatePicker');
    expect(source).not.toContain('type="date"');
  });
});
