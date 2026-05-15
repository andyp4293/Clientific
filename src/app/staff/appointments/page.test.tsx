import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('staff appointments page', () => {
  it('keeps employee access appointment-only and privacy-safe', () => {
    const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

    expect(source).toContain("session.user.accountType !== 'staff'");
    expect(source).toContain('session.user.staffPasswordChangeRequired');
    expect(source).toContain("redirect('/staff/set-password')");
    expect(source).toContain('portalAccessEnabled: true');
    expect(source).toContain('staffId: staff.id');
    expect(source).toContain('customer: {');
    expect(source).toContain('name: true');
    expect(source).not.toContain('phone: true');
    expect(source).toContain('Customer phone numbers and CRM details stay private');
    expect(source).toContain('Phone numbers hidden');
    expect(source).toContain('Next assigned appointments');
    expect(source).toContain('upcomingAppointments');
  });
});
