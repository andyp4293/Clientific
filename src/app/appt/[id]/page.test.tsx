import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('Appointment public page source', () => {
  it('shows the shared owner back button when the viewer can manage the appointment', () => {
    const filePath = path.join(process.cwd(), 'src/app/appt/[id]/page.tsx');
    const source = readFileSync(filePath, 'utf8');

    expect(source).toContain('PublicOwnerBackButton');
    expect(source).toContain('data?.viewerCanManage');
    expect(source).toContain('fallbackHref="/dashboard/appointments"');
  });

  it('passes the full service bundle when loading reschedule slots', () => {
    const filePath = path.join(process.cwd(), 'src/app/appt/[id]/page.tsx');
    const source = readFileSync(filePath, 'utf8');

    expect(source).toContain("p.set('serviceIds', serviceIds.join(','))");
    expect(source).toContain('Your reschedule request has been submitted for review.');
  });
});
