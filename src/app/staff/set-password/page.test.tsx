import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('staff set password page', () => {
  it('requires staff accounts with temporary passwords and sends completed users to appointments', () => {
    const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
    const formSource = readFileSync(
      new URL('./StaffSetPasswordForm.tsx', import.meta.url),
      'utf8',
    );

    expect(source).toContain("session.user.accountType !== 'staff'");
    expect(source).toContain('!session.user.staffPasswordChangeRequired');
    expect(source).toContain("redirect('/staff/appointments')");
    expect(formSource).toContain("fetch('/api/staff/password'");
    expect(formSource).toContain("signIn('credentials'");
    expect(formSource).toContain("window.location.assign('/staff/appointments')");
  });
});
