import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('dashboard shell theming', () => {
  it('keeps shared dashboard chrome on centralized surfaces with readable dark-mode contrast', () => {
    const nav = readFileSync(join(process.cwd(), 'src', 'components', 'layout', 'DashboardNav.tsx'), 'utf8');
    const mobileNav = readFileSync(join(process.cwd(), 'src', 'components', 'layout', 'MobileBottomNav.tsx'), 'utf8');
    const banner = readFileSync(join(process.cwd(), 'src', 'components', 'billing', 'SubscriptionBanner.tsx'), 'utf8');
    const toggle = readFileSync(join(process.cwd(), 'src', 'components', 'ui', 'ThemeToggle.tsx'), 'utf8');
    const dashboard = readFileSync(join(process.cwd(), 'src', 'app', '(dashboard)', 'dashboard', 'page.tsx'), 'utf8');

    expect(nav).toContain('brand-panel flex h-full flex-col');
    expect(nav).not.toContain('bg-white/80');
    expect(nav).toContain("dark:text-gray-200");

    expect(mobileNav).toContain('brand-panel fixed left-0 right-0');
    expect(mobileNav).toContain('sticky top-0');
    expect(mobileNav).toContain('grid-cols-5');
    expect(mobileNav).toContain('bg-[rgb(var(--color-gray-50))]');
    expect(mobileNav).toContain('dark:bg-[rgb(var(--color-gray-900))]');
    expect(mobileNav).not.toContain('justify-around');
    expect(mobileNav).not.toContain('bg-white/92');

    expect(banner).toContain('dark:bg-primary-950/55');
    expect(banner).toContain('dark:bg-orange-950/55');
    expect(banner).not.toContain('dark:bg-primary/12');

    expect(toggle).toContain('dark:text-gray-200');
    expect(toggle).toContain('title={`Theme: ${labels[current]} - click to change`}');
    expect(toggle).not.toContain('â');

    expect(dashboard).toContain('bg-white/90 dark:bg-gray-900/80');
    expect(dashboard).toContain('dark:text-gray-300');
  });
});
