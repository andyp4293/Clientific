import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('public booking page source', () => {
  it('supports grouped services accordion and ungrouped fallback section', () => {
    const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

    expect(source).toContain('groupServicesForDisplay');
    expect(source).toContain('Other Services');
    expect(source).toContain('ServiceOptionCard');
  });

  it('shows a dedicated off-day empty state when the selected staff member is not working', () => {
    const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

    expect(source).toContain('getEmptyAvailabilityState');
    expect(source).toContain("availabilityReason: slotsData?.availabilityReason");
    expect(source).toContain("availabilityMessage: slotsData?.message");
    expect(source).toContain('selectedStaffName');
  });

  it('uses owner-aware back navigation instead of any signed-in session', () => {
    const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');

    expect(source).toContain('PublicOwnerBackButton');
    expect(source).toContain('const viewerCanManage = businessData?.viewerCanManage === true;');
    expect(source).not.toContain('useSession');
  });
});
