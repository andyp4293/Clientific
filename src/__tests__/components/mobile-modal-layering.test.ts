import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('mobile modal layering contract', () => {
  it('keeps dashboard and customer modals above the fixed mobile tab bar', () => {
    const modalFiles = [
      ['src', 'components', 'customers', 'AddCustomerModal.tsx'],
      ['src', 'components', 'customers', 'EditCustomerModal.tsx'],
      ['src', 'components', 'customers', 'SendCustomerMessageModal.tsx'],
      ['src', 'components', 'operations', 'AiReceptionistManager.tsx'],
      ['src', 'app', '(dashboard)', 'dashboard', 'appointments', 'page.tsx'],
      ['src', 'app', '(dashboard)', 'dashboard', 'checkins', 'page.tsx'],
      ['src', 'app', '(dashboard)', 'dashboard', 'campaigns', 'page.tsx'],
      ['src', 'app', '(dashboard)', 'dashboard', 'services', 'page.tsx'],
      ['src', 'app', '(dashboard)', 'dashboard', 'settings', 'page.tsx'],
    ];

    for (const segments of modalFiles) {
      const source = readFileSync(join(process.cwd(), ...segments), 'utf8');
      expect(source).toContain('z-[70]');
    }
  });

  it('keeps the longest mobile dialogs within the viewport instead of pinning actions behind the tab bar', () => {
    const constrainedFiles = [
      ['src', 'components', 'customers', 'AddCustomerModal.tsx'],
      ['src', 'components', 'customers', 'EditCustomerModal.tsx'],
      ['src', 'app', '(dashboard)', 'dashboard', 'appointments', 'page.tsx'],
      ['src', 'app', '(dashboard)', 'dashboard', 'checkins', 'page.tsx'],
      ['src', 'app', '(dashboard)', 'dashboard', 'services', 'page.tsx'],
    ];

    for (const segments of constrainedFiles) {
      const source = readFileSync(join(process.cwd(), ...segments), 'utf8');
      expect(source).toContain('max-h-[calc(100dvh-1rem)]');
    }
  });
});
