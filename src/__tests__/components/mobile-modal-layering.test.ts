import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('mobile modal layering contract', () => {
  it('keeps dashboard and customer modals above the fixed mobile tab bar', () => {
    const modalFiles = [
      ['src', 'components', 'customers', 'AddCustomerModal.tsx'],
      ['src', 'components', 'customers', 'CustomerGroupModal.tsx'],
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
      expect(source).toContain('data-mobile-overlay="true"');
    }
  });

  it('keeps long mobile dialogs either constrained or fully fullscreen so actions stay reachable', () => {
    const constrainedFiles = [];
    const fullscreenFiles = [
      ['src', 'app', '(dashboard)', 'dashboard', 'checkins', 'page.tsx'],
      ['src', 'components', 'customers', 'AddCustomerModal.tsx'],
      ['src', 'components', 'customers', 'CustomerGroupModal.tsx'],
      ['src', 'components', 'customers', 'EditCustomerModal.tsx'],
      ['src', 'components', 'customers', 'SendCustomerMessageModal.tsx'],
      ['src', 'app', '(dashboard)', 'dashboard', 'appointments', 'page.tsx'],
      ['src', 'app', '(dashboard)', 'dashboard', 'services', 'page.tsx'],
    ];

    for (const segments of constrainedFiles) {
      const source = readFileSync(join(process.cwd(), ...segments), 'utf8');
      expect(source).toContain('max-h-[calc(100dvh-1rem)]');
    }

    for (const segments of fullscreenFiles) {
      const source = readFileSync(join(process.cwd(), ...segments), 'utf8');
      expect(
        source.includes('h-[100dvh] w-full flex-col') ||
          source.includes('h-[100svh] min-h-[100svh] w-full flex-col') ||
          source.includes('h-full w-full flex-col')
      ).toBe(true);
    }
  });

  it('hides the mobile dashboard chrome whenever a modal overlay is present', () => {
    const layoutSource = readFileSync(
      join(process.cwd(), 'src', 'app', '(dashboard)', 'layout.tsx'),
      'utf8'
    );
    const watcherSource = readFileSync(
      join(process.cwd(), 'src', 'components', 'layout', 'MobileOverlayChromeWatcher.tsx'),
      'utf8'
    );
    const globalStyles = readFileSync(
      join(process.cwd(), 'src', 'app', 'globals.css'),
      'utf8'
    );

    expect(layoutSource).toContain('MobileOverlayChromeWatcher');
    expect(layoutSource).toContain('dashboard-mobile-header');
    expect(layoutSource).toContain('dashboard-mobile-bottom-nav');
    expect(watcherSource).toContain('dashboard-mobile-overlay-open');
    expect(watcherSource).toContain('document.documentElement.classList.toggle(BODY_CLASS, hasOverlay);');
    expect(globalStyles).toContain('body.dashboard-mobile-overlay-open .dashboard-mobile-header');
    expect(globalStyles).toContain('body.dashboard-mobile-overlay-open .dashboard-mobile-bottom-nav');
    expect(globalStyles).toContain('[data-mobile-overlay="true"] {');
    expect(globalStyles).toContain('background-color: rgb(var(--color-gray-50)) !important;');
    expect(globalStyles).toContain('html.dashboard-mobile-overlay-open,');
    expect(globalStyles).toContain('body.dashboard-mobile-overlay-open .dashboard-scroll');
  });
});
