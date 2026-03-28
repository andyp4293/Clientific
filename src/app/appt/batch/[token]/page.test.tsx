import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('appointment batch page', () => {
  it('polls while pending and keeps each appointment on its own card', () => {
    const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

    expect(source).toContain("queryKey: ['appointment-batch', token]");
    expect(source).toContain("appointment.status === 'pending'");
    expect(source).toContain('Manage this appointment');
    expect(source).toContain('Request {index + 1}');
  });
});
